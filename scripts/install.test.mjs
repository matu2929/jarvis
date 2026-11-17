import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { importLine, pluginCommands, publishedAgentsPath, withInstructions, withoutInstructions } from "./install.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "install.mjs");
const REPO_ROOT = join(dirname(SCRIPT), "..");
const PLUGIN_JSON = JSON.parse(readFileSync(join(REPO_ROOT, ".claude-plugin", "plugin.json"), "utf8"));

const INSTALL = [
  ["plugin", "marketplace", "add", "matu2929/jarvis"],
  ["plugin", "marketplace", "update", "jarvis"],
  ["plugin", "install", "jarvis@jarvis"],
  ["plugin", "update", "jarvis@jarvis"],
];

test("fresh install adds the marketplace from GitHub and installs the plugin", () => {
  assert.deepEqual(pluginCommands(undefined), INSTALL);
});

test("re-install from GitHub only refreshes and updates", () => {
  assert.deepEqual(pluginCommands({ source: "github", repo: "matu2929/jarvis" }), INSTALL);
});

test("a jarvis marketplace from another source is removed before adding the GitHub one", () => {
  const local = { source: "directory", path: "C:\\repos\\jarvis" };
  assert.deepEqual(pluginCommands(local), [["plugin", "marketplace", "remove", "jarvis"], ...INSTALL]);
});

test("uninstall removes the plugin and the marketplace", () => {
  assert.deepEqual(pluginCommands({ source: "github", repo: "matu2929/jarvis" }, true), [
    ["plugin", "uninstall", "jarvis@jarvis"],
    ["plugin", "marketplace", "remove", "jarvis"],
  ]);
});

test("the published AGENTS.md is the one in the user-scope plugin install", () => {
  const installed = {
    version: 2,
    plugins: {
      "jarvis@jarvis": [
        { scope: "project", installPath: "/cache/jarvis/jarvis/old" },
        { scope: "user", installPath: "/cache/jarvis/jarvis/abc123" },
      ],
    },
  };
  assert.equal(publishedAgentsPath(installed), join("/cache/jarvis/jarvis/abc123", "core", "AGENTS.md"));
  assert.equal(publishedAgentsPath({ version: 2, plugins: {} }), undefined);
  assert.equal(publishedAgentsPath(undefined), undefined);
});

test("plugin.json pins no version, so every pushed commit is an update", () => {
  assert.equal(PLUGIN_JSON.version, undefined);
});

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

    // The exit code depends on this machine's MCP setup (doctor), so assert on the files instead.
    assert.equal(run().error, undefined);
    const copy = join(dir, "jarvis", "AGENTS.md");
    assert.equal(readFileSync(copy, "utf8"), readFileSync(join(REPO_ROOT, "core", "AGENTS.md"), "utf8"));
    const installed = readFileSync(join(dir, "CLAUDE.md"), "utf8");
    assert.ok(installed.includes(importLine(copy)), "imports the copy, not the clone");
    assert.match(installed, /## Mine/);

    assert.equal(run("--uninstall").status, 0, "uninstall skips the doctor");
    assert.equal(readFileSync(join(dir, "CLAUDE.md"), "utf8"), "## Mine\n");
    assert.equal(existsSync(join(dir, "jarvis")), false, "uninstall removes the copy");

    // A <claude-dir>/jarvis folder may hold user files (even a clone): uninstall removes only the copy.
    run();
    writeFileSync(join(dir, "jarvis", "mine.txt"), "keep");
    run("--uninstall");
    assert.equal(existsSync(join(dir, "jarvis", "AGENTS.md")), false);
    assert.equal(readFileSync(join(dir, "jarvis", "mine.txt"), "utf8"), "keep");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
