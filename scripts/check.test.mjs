import { test } from "node:test";
import assert from "node:assert/strict";
import { checkMcpServers, parseFrontmatter } from "./check.mjs";

const registry = {
  servers: {
    engram: { purpose: "Memory", install: "https://example.com", command: "engram", args: ["mcp"], agents: ["implementer"] },
  },
};
const agent = (name, tools) => ({ name, tools });

test("passes when every listed agent declares the server's tools", () => {
  const agents = [agent("implementer", ["Read", "mcp__engram__*"]), agent("code-reviewer", ["Read"])];
  assert.deepEqual(checkMcpServers(registry, agents), []);
});

test("fails when a listed agent does not declare the server's tools", () => {
  const errors = checkMcpServers(registry, [agent("implementer", ["Read"])]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /implementer.*mcp__engram__\*/);
});

test("fails when a listed agent does not exist", () => {
  assert.match(checkMcpServers(registry, [])[0], /unknown agent "implementer"/);
});

test("fails when an agent uses an unregistered server or is not listed for it", () => {
  const agents = [agent("implementer", ["mcp__engram__*"]), agent("code-reviewer", ["mcp__github__*", "mcp__engram__*"])];
  const errors = checkMcpServers(registry, agents);
  assert.ok(errors.some((e) => /code-reviewer.*"mcp__github__\*".*matches no server/.test(e)));
  assert.ok(errors.some((e) => /code-reviewer.*not listed in the "engram" agents/.test(e)));
});

test("fails when a server entry misses required fields", () => {
  const broken = { servers: { x: { agents: [] } } };
  assert.ok(checkMcpServers(broken, []).some((e) => /purpose is required/.test(e)));
});

const httpRegistry = {
  servers: {
    context7: { purpose: "Docs", type: "http", url: "https://mcp.context7.com/mcp/oauth", bundled: true, agents: ["implementer"] },
  },
};
const bundled = { context7: { type: "http", url: "https://mcp.context7.com/mcp/oauth" } };

test("a bundled server is used through the plugin tool prefix", () => {
  assert.deepEqual(checkMcpServers(httpRegistry, [agent("implementer", ["mcp__plugin_jarvis_context7__*"])], { bundled }), []);
  const errors = checkMcpServers(httpRegistry, [agent("implementer", ["mcp__context7__*"])], { bundled });
  assert.ok(errors.some((e) => /implementer.*mcp__plugin_jarvis_context7__\*/.test(e)));
});

test("a bundled server must match the plugin MCP config", () => {
  assert.ok(checkMcpServers(httpRegistry, [agent("implementer", ["mcp__plugin_jarvis_context7__*"])], { bundled: {} })
    .some((e) => /not declared in adapters\/claude\/mcp\.json/.test(e)));
  const otherUrl = { context7: { type: "http", url: "https://other.example.com" } };
  assert.ok(checkMcpServers(httpRegistry, [agent("implementer", ["mcp__plugin_jarvis_context7__*"])], { bundled: otherUrl })
    .some((e) => /url does not match/.test(e)));
});

test("an http server needs a url and a stdio server needs install, command and args", () => {
  const broken = { servers: { a: { purpose: "x", type: "http", agents: [] }, b: { purpose: "x", agents: [] } } };
  const errors = checkMcpServers(broken, []);
  assert.ok(errors.some((e) => /\(a\).*url is required/.test(e)));
  assert.ok(errors.some((e) => /\(b\).*install, command and args/.test(e)));
});

test("parses frontmatter with nested keys", () => {
  assert.deepEqual(parseFrontmatter("---\nname: a\nmetadata:\n  kit: jarvis\n---\nbody"), { name: "a", metadata: { kit: "jarvis" } });
});
