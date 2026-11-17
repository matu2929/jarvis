import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "pre-tool-use.mjs");
let repo;

const run = (tool_name, tool_input, cwd = repo) => {
  const env = { ...process.env };
  delete env.JARVIS_SKIP_GIT_TRUST;
  return spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ hook_event_name: "PreToolUse", tool_name, tool_input, cwd }),
    encoding: "utf8",
    env,
  });
};
const git = (...args) => execFileSync("git", args, { cwd: repo, stdio: "ignore" });

before(() => {
  repo = mkdtempSync(join(tmpdir(), "jarvis-hook-"));
  git("init", "-q");
});
after(() => rmSync(repo, { recursive: true, force: true }));

test("blocks reading a real .env file and allows templates", () => {
  assert.equal(run("Read", { file_path: join(repo, ".env") }).status, 2);
  assert.equal(run("Read", { file_path: join(repo, ".env.example") }).status, 0);
  assert.equal(run("Bash", { command: "cat .env" }).status, 2);
});

test("allows unrelated tool calls", () => {
  assert.equal(run("Bash", { command: "git status" }).status, 0);
  assert.equal(run("Edit", { file_path: join(repo, "a.js") }).status, 0);
});

test("blocks a non-conventional commit message", () => {
  const result = run("Bash", { command: 'git commit -m "Added stuff"' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Conventional Commits/);
});

test("blocks committing a staged secret and allows a clean one", () => {
  writeFileSync(join(repo, "config.js"), `const t = "ghp_${"a".repeat(36)}";\n`);
  git("add", "config.js");
  const blocked = run("Bash", { command: 'git commit -m "feat: add config"' });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /config\.js:1 \[github-token\]/);

  writeFileSync(join(repo, "config.js"), "const t = process.env.TOKEN;\n");
  git("add", "config.js");
  assert.equal(run("Bash", { command: 'git commit -m "feat: add config"' }).status, 0);
});

test("blocks git in a repository whose local config runs programs", () => {
  git("config", "core.fsmonitor", "./payload.sh");
  const result = run("Bash", { command: "git status" });
  git("config", "--unset", "core.fsmonitor");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /core\.fsmonitor/);
});
