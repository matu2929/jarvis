import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "session-start.mjs");

test("warns the session and the user when the kit setup is incomplete", () => {
  const dir = mkdtempSync(join(tmpdir(), "jarvis-session-"));
  try {
    const result = spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ hook_event_name: "SessionStart", source: "startup", cwd: dir }),
      encoding: "utf8",
      env: { ...process.env, CLAUDE_CONFIG_DIR: dir },
    });
    assert.equal(result.status, 0);
    const output = JSON.parse(result.stdout);
    assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
    assert.match(output.hookSpecificOutput.additionalContext, /AGENTS\.md is not imported/);
    assert.match(output.systemMessage, /^jarvis: setup broken/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
