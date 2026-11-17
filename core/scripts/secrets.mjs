// Scans added lines of a unified diff for well-known secret formats.
// Also usable as a git `pre-commit` hook (scans the staged diff):
//   node core/scripts/secrets.mjs
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ALLOW_MARKER = "jarvis:allow-secret";

// Order matters: the first matching rule wins for a line.
const RULES = [
  { id: "private-key", pattern: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/ },
  { id: "aws-access-key", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { id: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { id: "github-pat", pattern: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/ },
  { id: "slack-token", pattern: /\bxox[abposr]-[A-Za-z0-9-]{10,}\b/ },
  { id: "stripe-live-key", pattern: /\b[sr]k_live_[A-Za-z0-9]{20,}\b/ },
  { id: "anthropic-key", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { id: "openai-key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/ },
  { id: "google-api-key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
];

const mask = (value) => `${value.slice(0, 4)}…[redacted]`;

export function findSecrets(diff) {
  const findings = [];
  let file = null;
  let line = 0;

  for (const raw of String(diff ?? "").split(/\r?\n/)) {
    if (raw.startsWith("+++ ")) {
      file = raw.slice(4).replace(/^b\//, "");
      continue;
    }
    if (raw.startsWith("--- ")) continue;
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (raw.startsWith("+")) {
      const content = raw.slice(1);
      if (!content.includes(ALLOW_MARKER)) {
        for (const rule of RULES) {
          const match = rule.pattern.exec(content);
          if (match) {
            findings.push({ file, line, rule: rule.id, excerpt: content.replace(match[0], mask(match[0])).trim() });
            break;
          }
        }
      }
      line++;
    } else if (raw.startsWith(" ")) {
      line++;
    }
  }
  return findings;
}

export function formatFindings(findings) {
  return findings.map((f) => `  ${f.file}:${f.line} [${f.rule}] ${f.excerpt}`).join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const diff = execFileSync("git", ["diff", "--cached", "-U0", "--no-color"], { encoding: "utf8" });
  const findings = findSecrets(diff);
  if (findings.length) {
    console.error(`secrets: possible secrets in staged changes:\n${formatFindings(findings)}`);
    console.error(`If a match is a false positive, add "${ALLOW_MARKER}" to that line.`);
    process.exit(1);
  }
}
