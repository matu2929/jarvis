import { test } from "node:test";
import assert from "node:assert/strict";
import { invokesGit, isGitCommit, commitStagesAll, extractCommitMessage } from "./shell.mjs";

test("detects git invocations", () => {
  assert.equal(invokesGit("git status"), true);
  assert.equal(invokesGit("cd repo && git log"), true);
  assert.equal(invokesGit("npm test"), false);
  assert.equal(invokesGit("echo digit"), false);
});

test("detects git commit, including global options", () => {
  assert.equal(isGitCommit('git commit -m "feat: x"'), true);
  assert.equal(isGitCommit('git -C repo commit -m "feat: x"'), true);
  assert.equal(isGitCommit("git add . && git commit"), true);
  assert.equal(isGitCommit("git log --grep commit"), false);
  assert.equal(isGitCommit("git status"), false);
});

test("detects commits that stage tracked changes", () => {
  assert.equal(commitStagesAll('git commit -am "feat: x"'), true);
  assert.equal(commitStagesAll('git commit --all -m "feat: x"'), true);
  assert.equal(commitStagesAll('git commit -m "feat: x"'), false);
});

test("extracts a -m message", () => {
  assert.equal(extractCommitMessage('git commit -m "feat: add login"'), "feat: add login");
  assert.equal(extractCommitMessage("git commit -m 'fix: typo'"), "fix: typo");
  assert.equal(extractCommitMessage('git commit -am "chore: bump"'), "chore: bump");
});

test("joins several -m paragraphs", () => {
  assert.equal(extractCommitMessage('git commit -m "feat: x" -m "Body text."'), "feat: x\n\nBody text.");
});

test("extracts a heredoc message", () => {
  const cmd = "git commit -m \"$(cat <<'EOF'\nfeat: add login\n\nBody line.\nEOF\n)\"";
  assert.equal(extractCommitMessage(cmd), "feat: add login\n\nBody line.");
});

test("returns null when the message cannot be known", () => {
  assert.equal(extractCommitMessage("git commit"), null);
  assert.equal(extractCommitMessage("git commit -F msg.txt"), null);
  assert.equal(extractCommitMessage('git commit -m "$MSG"'), null);
});
