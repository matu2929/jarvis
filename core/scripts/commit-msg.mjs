// Conventional Commits linter. Also usable as a git `commit-msg` hook:
//   node core/scripts/commit-msg.mjs <path-to-message-file>
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const TYPES = ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"];
const HEADER = new RegExp(`^(${TYPES.join("|")})(\\([^()\\r\\n]+\\))?!?: \\S`);
const MAX_HEADER = 100;
const AI_ATTRIBUTION = [
  /^co-authored-by:.*\b(claude|anthropic|openai|chatgpt|gpt|copilot|gemini|cursor|codex)\b/im,
  /generated with \[?claude/i,
  /🤖 generated/i,
];

export function lintCommitMessage(message) {
  const lines = String(message ?? "")
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("#"));
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.join("").trim()) return ["Commit message is empty."];

  const errors = [];
  const header = lines[0];
  const generatedByGit = /^Merge /.test(header) || /^Revert "/.test(header);

  if (!generatedByGit && !HEADER.test(header)) {
    errors.push(
      `Header must follow Conventional Commits: "<type>(<scope>)?: <description>" with type one of ${TYPES.join(", ")}. Got: "${header}"`,
    );
  }
  if (header.length > MAX_HEADER) {
    errors.push(`Header must be at most ${MAX_HEADER} characters (got ${header.length}).`);
  }
  if (lines.length > 1 && lines[1].trim()) {
    errors.push("Leave a blank line between the header and the body.");
  }
  const text = lines.join("\n");
  if (AI_ATTRIBUTION.some((pattern) => pattern.test(text))) {
    errors.push("Remove AI attribution (Co-Authored-By an AI, 'Generated with ...').");
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: commit-msg.mjs <message-file>");
    process.exit(1);
  }
  const errors = lintCommitMessage(readFileSync(file, "utf8"));
  for (const error of errors) console.error(`commit-msg: ${error}`);
  process.exit(errors.length ? 1 : 0);
}
