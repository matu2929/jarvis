import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diagnose, collectFacts, formatReport, registerCommand } from "./doctor.mjs";

const engram = { name: "engram", installed: true, registered: true, install: "https://example.com/engram", register: "claude mcp add --scope user engram -- engram mcp" };
const healthy = { importPath: "/kit/core/AGENTS.md", importTargetExists: true, mcp: [engram] };
const ids = (facts) => diagnose(facts).map((p) => p.id);
const registry = { servers: { engram: { purpose: "Memory", install: "https://example.com/engram", command: "engram", args: ["mcp"], agents: [] } } };

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

test("reports a required MCP server not installed, or installed but not registered", () => {
  assert.deepEqual(ids({ ...healthy, mcp: [{ ...engram, installed: false, registered: false }] }), ["mcp-missing:engram"]);
  const [problem] = diagnose({ ...healthy, mcp: [{ ...engram, registered: false }] });
  assert.equal(problem.id, "mcp-unregistered:engram");
  assert.match(problem.fix, /claude mcp add --scope user engram -- engram mcp/);
});

test("builds the register command from the registry entry", () => {
  assert.equal(registerCommand("engram", registry.servers.engram), "claude mcp add --scope user engram -- engram mcp");
});

test("builds an http register command", () => {
  assert.equal(
    registerCommand("docs", { type: "http", url: "https://example.com/mcp" }),
    "claude mcp add --scope user --transport http docs https://example.com/mcp",
  );
});

test("treats bundled http servers as provided by the plugin, and checks others are registered", () => {
  const httpRegistry = {
    servers: {
      context7: { purpose: "Docs", type: "http", url: "https://mcp.context7.com/mcp/oauth", bundled: true, agents: [] },
      docs: { purpose: "Docs", type: "http", url: "https://example.com/mcp", install: "https://example.com", agents: [] },
    },
  };
  const facts = collectFacts({ claudeDir: "/none", claudeJson: "/none.json", cwd: tmpdir(), registry: httpRegistry, which: () => false });
  assert.deepEqual(diagnose({ ...healthy, mcp: facts.mcp }).map((p) => p.id), ["mcp-unregistered:docs"]);
});

test("formats a report that tells the agent to stop until setup is fixed", () => {
  const report = formatReport(diagnose({ ...healthy, mcp: [{ ...engram, registered: false }] }));
  assert.match(report, /jarvis-kit setup is broken/);
  assert.match(report, /do not start the requested task/);
  assert.match(report, /claude mcp add/);
});

test("collects facts from the Claude config files and the registry", () => {
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

    const facts = collectFacts({ claudeDir, claudeJson, cwd: dir, registry, which: () => true });
    assert.deepEqual(facts, { ...healthy, importPath: join(kit, "AGENTS.md").replace(/\\/g, "/") });

    writeFileSync(join(claudeDir, "CLAUDE.md"), "# nothing\n");
    writeFileSync(claudeJson, "{}");
    const empty = collectFacts({ claudeDir, claudeJson, cwd: dir, registry, which: () => false });
    assert.deepEqual(empty, { importPath: null, importTargetExists: false, mcp: [{ ...engram, installed: false, registered: false }] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("finds a server registered in the project .mcp.json", () => {
  const dir = mkdtempSync(join(tmpdir(), "jarvis-doctor-"));
  try {
    writeFileSync(join(dir, ".mcp.json"), JSON.stringify({ mcpServers: { engram: { command: "engram" } } }));
    const facts = collectFacts({ claudeDir: join(dir, "none"), claudeJson: join(dir, "none.json"), cwd: dir, registry, which: () => true });
    assert.equal(facts.mcp[0].registered, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loads the kit registry by default", () => {
  const facts = collectFacts({ claudeDir: "/none", claudeJson: "/none.json", cwd: tmpdir(), which: () => false });
  assert.ok(facts.mcp.some((server) => server.name === "engram"));
});
