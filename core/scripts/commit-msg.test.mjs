import { test } from "node:test";
import assert from "node:assert/strict";
import { lintCommitMessage } from "./commit-msg.mjs";

test("accepts a conventional header", () => {
  assert.deepEqual(lintCommitMessage("feat: add login"), []);
  assert.deepEqual(lintCommitMessage("fix(api)!: drop v1 endpoint"), []);
});

test("accepts a header with body separated by a blank line", () => {
  assert.deepEqual(lintCommitMessage("docs: update readme\n\nExplain install steps."), []);
});

test("accepts git-generated merge and revert messages", () => {
  assert.deepEqual(lintCommitMessage("Merge branch 'main' into feature"), []);
  assert.deepEqual(lintCommitMessage('Revert "feat: add login"'), []);
});

test("rejects a non-conventional header", () => {
  const errors = lintCommitMessage("Added login");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Conventional Commits/);
});

test("rejects an unknown type", () => {
  assert.equal(lintCommitMessage("feature: add login").length, 1);
});

test("rejects an empty message", () => {
  assert.match(lintCommitMessage("  \n# comment\n")[0], /empty/);
});

test("rejects a header longer than 100 characters", () => {
  const errors = lintCommitMessage(`feat: ${"x".repeat(100)}`);
  assert.ok(errors.some((e) => /100 characters/.test(e)));
});

test("rejects a body without a blank line after the header", () => {
  const errors = lintCommitMessage("feat: add login\nmore details");
  assert.ok(errors.some((e) => /blank line/.test(e)));
});

test("rejects AI attribution", () => {
  const msg = "feat: add login\n\nCo-Authored-By: Claude Opus <noreply@anthropic.com>";
  assert.ok(lintCommitMessage(msg).some((e) => /AI attribution/.test(e)));
  const generated = "feat: add login\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)";
  assert.ok(lintCommitMessage(generated).some((e) => /AI attribution/.test(e)));
});

test("allows a human co-author", () => {
  assert.deepEqual(lintCommitMessage("feat: pair work\n\nCo-Authored-By: Jane Doe <jane@example.com>"), []);
});

test("ignores git comment lines", () => {
  assert.deepEqual(lintCommitMessage("feat: add login\n# Please enter the commit message"), []);
});
