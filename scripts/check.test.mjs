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
  assert.ok(errors.some((e) => /code-reviewer.*"github".*not registered/.test(e)));
  assert.ok(errors.some((e) => /code-reviewer.*not listed in the "engram" agents/.test(e)));
});

test("fails when a server entry misses required fields", () => {
  const broken = { servers: { x: { agents: [] } } };
  assert.ok(checkMcpServers(broken, []).some((e) => /purpose, install, command/.test(e)));
});

test("parses frontmatter with nested keys", () => {
  assert.deepEqual(parseFrontmatter("---\nname: a\nmetadata:\n  kit: jarvis\n---\nbody"), { name: "a", metadata: { kit: "jarvis" } });
});
