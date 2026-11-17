import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diagnose, collectFacts, formatReport } from "./doctor.mjs";

const healthy = { importPath: "/kit/core/AGENTS.md", importTargetExists: true, engramInstalled: true, engramRegistered: true };
const ids = (facts) => diagnose(facts).map((p) => p.id);

test("reports nothing when the kit is fully installed", () => {
  assert.deepEqual(diagnose(healthy), []);
  assert.equal(formatReport([]), "");
});

test("reports a missing AGENTS.md import with the install command", () => {
  const [problem] = diagnose({ ...healthy, importPath: null, importTargetExists: false });
  assert.equal(problem.id, "instructions-missing");
  assert.match(problem.fix, /node scripts\/install\.mjs/);
});

test("reports an import that points to a missing file", () => {
  assert.deepEqual(ids({ ...healthy, importTargetExists: false }), ["instructions-broken"]);
});

test("reports Engram not installed, or installed but not registered", () => {
  assert.deepEqual(ids({ ...healthy, engramInstalled: false, engramRegistered: false }), ["engram-missing"]);
  const [problem] = diagnose({ ...healthy, engramRegistered: false });
  assert.equal(problem.id, "engram-unregistered");
  assert.match(problem.fix, /claude mcp add --scope user engram -- engram mcp/);
});

test("formats a report that asks the agent to tell the user", () => {
  const report = formatReport(diagnose({ ...healthy, engramRegistered: false }));
  assert.match(report, /jarvis-kit setup is incomplete/);
  assert.match(report, /claude mcp add/);
});

test("collects facts from the Claude config files", () => {
  const dir = mkdtempSync(join(tmpdir(), "jarvis-doctor-"));
  try {
    const kit = join(dir, "my kit", "core");
    mkdirSync(kit, { recursive: true });
    writeFileSync(join(kit, "AGENTS.md"), "# rules\n");
    const claudeDir = join(dir, ".claude");
    mkdirSync(claudeDir);
    const agentsImport = `@${join(kit, "AGENTS.md").replace(/\\/g, "/").replace(/ /g, "\\ ")}`;
    writeFileSync(join(claudeDir, "CLAUDE.md"), `<!-- jarvis-kit:start -->\n${agentsImport}\n<!-- jarvis-kit:end -->\n`);
    const claudeJson = join(dir, ".claude.json");
    writeFileSync(claudeJson, JSON.stringify({ mcpServers: { engram: { command: "engram", args: ["mcp"] } } }));

    const facts = collectFacts({ claudeDir, claudeJson, cwd: dir, which: () => true });
    assert.deepEqual(facts, { ...healthy, importPath: join(kit, "AGENTS.md").replace(/\\/g, "/") });

    writeFileSync(join(claudeDir, "CLAUDE.md"), "# nothing\n");
    writeFileSync(claudeJson, "{}");
    const empty = collectFacts({ claudeDir, claudeJson, cwd: dir, which: () => false });
    assert.deepEqual(empty, { importPath: null, importTargetExists: false, engramInstalled: false, engramRegistered: false });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("finds Engram registered in the project .mcp.json", () => {
  const dir = mkdtempSync(join(tmpdir(), "jarvis-doctor-"));
  try {
    writeFileSync(join(dir, ".mcp.json"), JSON.stringify({ mcpServers: { engram: { command: "engram" } } }));
    const facts = collectFacts({ claudeDir: join(dir, "none"), claudeJson: join(dir, "none.json"), cwd: dir, which: () => true });
    assert.equal(facts.engramRegistered, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
