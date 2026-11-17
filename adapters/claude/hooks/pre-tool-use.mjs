// Claude Code PreToolUse hook: wires the core checks to Claude's tool calls.
// Exit 2 blocks the tool call and shows stderr to Claude; any other failure is non-blocking.
import { execFileSync } from "node:child_process";
import { isProtectedEnvPath, commandReadsEnvFile } from "../../../core/scripts/env-guard.mjs";
import { findDangerousGitConfig } from "../../../core/scripts/git-trust.mjs";
import { invokesGit, isGitCommit, commitStagesAll, extractCommitMessage } from "../../../core/scripts/shell.mjs";
import { lintCommitMessage } from "../../../core/scripts/commit-msg.mjs";
import { findSecrets, formatFindings } from "../../../core/scripts/secrets.mjs";

const ENV_BLOCKED =
  "jarvis: reading real .env files is blocked to keep secrets out of the context. Use .env.example, or ask the user for the specific non-secret value you need.";

function git(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 });
  } catch {
    return "";
  }
}

function block(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function checkBash(command, cwd) {
  if (commandReadsEnvFile(command)) block(ENV_BLOCKED);
  if (!invokesGit(command)) return;

  if (process.env.JARVIS_SKIP_GIT_TRUST !== "1") {
    const dangerous = findDangerousGitConfig(git(["config", "--local", "--list"], cwd));
    if (dangerous.length) {
      const list = dangerous.map((d) => `  ${d.key}=${d.value}`).join("\n");
      block(
        `jarvis: this repository's .git/config can make git run arbitrary programs:\n${list}\n` +
          "Do not run git here until the user inspects .git/config and confirms it is trusted. " +
          "The user can bypass this check with JARVIS_SKIP_GIT_TRUST=1.",
      );
    }
  }

  if (!isGitCommit(command)) return;

  const message = extractCommitMessage(command);
  if (message !== null) {
    const errors = lintCommitMessage(message);
    if (errors.length) block(`jarvis: invalid commit message:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }

  let diff = git(["diff", "--cached", "-U0", "--no-color"], cwd);
  if (commitStagesAll(command)) diff += git(["diff", "-U0", "--no-color"], cwd);
  const secrets = findSecrets(diff);
  if (secrets.length) {
    block(
      `jarvis: possible secrets in the changes being committed:\n${formatFindings(secrets)}\n` +
        'Remove them. If a match is a false positive, add "jarvis:allow-secret" to that line.',
    );
  }
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const { tool_name: tool, tool_input: input = {}, cwd = process.cwd() } = JSON.parse(raw || "{}");

  if (tool === "Read" && isProtectedEnvPath(input.file_path)) block(ENV_BLOCKED);
  if (tool === "Grep" && (isProtectedEnvPath(input.path) || isProtectedEnvPath(input.glob))) block(ENV_BLOCKED);
  if (tool === "Bash") checkBash(String(input.command ?? ""), cwd);
}

main().catch((error) => {
  process.stderr.write(`jarvis hook error (non-blocking): ${error.message}\n`);
  process.exit(1);
});
