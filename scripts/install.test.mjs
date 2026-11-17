import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { importLine, withInstructions, withoutInstructions } from "./install.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "install.mjs");

test("import line uses forward slashes and escapes spaces", () => {
  assert.equal(importLine("C:\\My Repos\\kit\\core\\AGENTS.md"), "@C:/My\\ Repos/kit/core/AGENTS.md");
});

test("adds the block above existing content and keeps it", () => {
  const result = withInstructions("## My notes\n", "/kit/core/AGENTS.md");
  assert.match(result, /^<!-- jarvis:start -->\n@\/kit\/core\/AGENTS\.md\n<!-- jarvis:end -->\n\n## My notes\n$/);
});

test("replaces a block written under the old jarvis-kit markers", () => {
  const legacy = "<!-- jarvis-kit:start -->\n@/old/AGENTS.md\n<!-- jarvis-kit:end -->\n\n## My notes\n";
  assert.equal(withInstructions(legacy, "/kit/core/AGENTS.md"), withInstructions("## My notes\n", "/kit/core/AGENTS.md"));
  assert.equal(withoutInstructions(legacy), "## My notes\n");
});

test("is idempotent and replaces an outdated block", () => {
  const once = withInstructions("", "/old/AGENTS.md");
  assert.equal(withInstructions(once, "/old/AGENTS.md"), once);
  const moved = withInstructions(once, "/new/AGENTS.md");
  assert.match(moved, /@\/new\/AGENTS\.md/);
  assert.doesNotMatch(moved, /old/);
});

test("uninstall removes only the block", () => {
  const installed = withInstructions("## My notes\n", "/kit/core/AGENTS.md");
  assert.equal(withoutInstructions(installed), "## My notes\n");
});

test("CLI installs and uninstalls instructions in a given claude dir", () => {
  const dir = mkdtempSync(join(tmpdir(), "jarvis-install-"));
  try {
    writeFileSync(join(dir, "CLAUDE.md"), "## Mine\n");
    const run = (...args) =>
      spawnSync(process.execPath, [SCRIPT, "--skip-plugin", "--claude-dir", dir, ...args], { encoding: "utf8" });

    // The exit code depends on this machine's MCP setup (doctor), so assert on the file instead.
    assert.equal(run().error, undefined);
    const installed = readFileSync(join(dir, "CLAUDE.md"), "utf8");
    assert.match(installed, /core\/AGENTS\.md/);
    assert.match(installed, /## Mine/);

    assert.equal(run("--uninstall").status, 0, "uninstall skips the doctor");
    assert.equal(readFileSync(join(dir, "CLAUDE.md"), "utf8"), "## Mine\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
