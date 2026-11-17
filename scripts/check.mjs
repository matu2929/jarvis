// Lints the kit itself: skill and agent frontmatter, naming rules, and manifest paths.
// Usage: node scripts/check.mjs
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Skills Claude Code ships with; reusing these names makes /<name> and skill selection ambiguous.
const RESERVED = new Set(["code-review", "security-review", "simplify", "init", "review", "run", "loop", "schedule", "update-config"]);

const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);

// Minimal YAML frontmatter parser: `key: value` lines plus one level of indented children.
export function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return null;
  const data = {};
  let parent = null;
  for (const line of match[1].split(/\r?\n/)) {
    const child = /^\s+([\w-]+):\s*(.*)$/.exec(line);
    const top = /^([\w-]+):\s*(.*)$/.exec(line);
    if (top) {
      parent = top[2] === "" ? (data[top[1]] = {}) : null;
      if (top[2] !== "") data[top[1]] = top[2];
    } else if (child && parent) {
      parent[child[1]] = child[2];
    }
  }
  return data;
}

function checkSkills() {
  const dir = join(ROOT, "core", "skills");
  for (const name of readdirSync(dir)) {
    const where = `core/skills/${name}`;
    const file = join(dir, name, "SKILL.md");
    if (!existsSync(file)) {
      fail(where, "missing SKILL.md");
      continue;
    }
    const fm = parseFrontmatter(readFileSync(file, "utf8"));
    if (!fm) {
      fail(where, "missing frontmatter");
      continue;
    }
    if (fm.name !== name) fail(where, `name "${fm.name}" must match the directory name`);
    if (!NAME.test(name) || name.length > 64) fail(where, "name must be lowercase kebab-case, max 64 chars");
    if (RESERVED.has(name)) fail(where, `name collides with a Claude Code built-in skill`);
    if (!fm.description || fm.description.length > 1024) fail(where, "description is required, max 1024 chars");
    if (fm.metadata?.kit !== "jarvis") fail(where, 'metadata.kit must be "jarvis"');
  }
}

// Every MCP server in core/mcp-servers.json is required. Agents with a `tools` allowlist only see an MCP
// server's tools when they list them, so the registry names the agents that need each server.
// Bundled servers ship in the plugin's MCP config, and Claude Code prefixes their tools with the plugin name.
export const toolWildcard = (name, server, plugin = "jarvis") =>
  server.bundled ? `mcp__plugin_${plugin}_${name}__*` : `mcp__${name}__*`;

export function checkMcpServers(registry, agents, { bundled = {}, plugin = "jarvis" } = {}) {
  const problems = [];
  const servers = registry.servers ?? {};
  const byName = new Map(agents.map((a) => [a.name, a]));

  for (const [name, server] of Object.entries(servers)) {
    const where = `core/mcp-servers.json (${name})`;
    if (!server.purpose) problems.push(`${where}: purpose is required`);
    if (server.type === "http") {
      if (!server.url) problems.push(`${where}: url is required for http servers`);
    } else if (!server.install || !server.command || !Array.isArray(server.args)) {
      problems.push(`${where}: install, command and args are required for stdio servers`);
    }
    if (server.bundled) {
      if (!bundled[name]) problems.push(`${where}: bundled but not declared in adapters/claude/mcp.json`);
      else if (bundled[name].url !== server.url) problems.push(`${where}: url does not match adapters/claude/mcp.json`);
    }
    const wildcard = toolWildcard(name, server, plugin);
    for (const agentName of server.agents ?? []) {
      const agent = byName.get(agentName);
      if (!agent) problems.push(`${where}: unknown agent "${agentName}"`);
      else if (!agent.tools.includes(wildcard)) {
        problems.push(`agent ${agentName}: needs "${wildcard}" in its tools (listed in core/mcp-servers.json)`);
      }
    }
  }

  const wildcards = new Map(Object.entries(servers).map(([name, server]) => [toolWildcard(name, server, plugin), name]));
  for (const agent of agents) {
    for (const tool of agent.tools.filter((t) => t.startsWith("mcp__"))) {
      const server = wildcards.get(tool);
      if (!server) problems.push(`agent ${agent.name}: uses "${tool}", which matches no server in core/mcp-servers.json`);
      else if (!(servers[server].agents ?? []).includes(agent.name)) {
        problems.push(`agent ${agent.name}: uses "${server}" but is not listed in the "${server}" agents of core/mcp-servers.json`);
      }
    }
  }
  return problems;
}

function checkPlugin() {
  const manifest = JSON.parse(readFileSync(join(ROOT, ".claude-plugin", "plugin.json"), "utf8"));
  const paths = [...[manifest.skills].flat(), ...[manifest.agents].flat(), ...[manifest.hooks].flat()].filter(Boolean);
  for (const path of paths) {
    if (!existsSync(join(ROOT, path))) fail("plugin.json", `path not found: ${path}`);
  }
  const agents = [];
  for (const path of [manifest.agents].flat()) {
    const fm = parseFrontmatter(readFileSync(join(ROOT, path), "utf8"));
    const expected = basename(path, ".md");
    if (!fm) fail(path, "missing frontmatter");
    else {
      if (fm.name !== expected) fail(path, `name "${fm.name}" must match the file name`);
      if (!fm.description) fail(path, "description is required");
      agents.push({ name: fm.name, tools: String(fm.tools ?? "").split(",").map((t) => t.trim()).filter(Boolean) });
    }
  }
  const registry = JSON.parse(readFileSync(join(ROOT, "core", "mcp-servers.json"), "utf8"));
  const bundledFile = join(ROOT, "adapters", "claude", "mcp.json");
  const bundled = existsSync(bundledFile) ? JSON.parse(readFileSync(bundledFile, "utf8")).mcpServers ?? {} : {};
  for (const problem of checkMcpServers(registry, agents, { bundled, plugin: manifest.name })) errors.push(problem);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkSkills();
  checkPlugin();
  if (errors.length) {
    console.error(errors.map((e) => `✖ ${e}`).join("\n"));
    process.exit(1);
  }
  console.log("✔ kit check passed");
}
