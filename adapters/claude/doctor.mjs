// Checks that jarvis-kit is fully installed for Claude Code.
// The plugin can be installed on its own (e.g. `claude plugin install`), which skips scripts/install.mjs,
// so the session-start hook and the installer both use this to report what is missing.
// Every MCP server in core/mcp-servers.json is required: a missing one breaks the setup.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_URL = "https://github.com/matu2929/jarvis-kit";
const REGISTRY = resolve(dirname(fileURLToPath(import.meta.url)), "../../core/mcp-servers.json");
const AGENTS_IMPORT = /^@((?:\\ |\S)*core\/AGENTS\.md)\s*$/m;

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
};
const readText = (path) => (existsSync(path) ? readFileSync(path, "utf8") : "");
const normalize = (path) => String(path).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

function defaultWhich(bin) {
  const finder = process.platform === "win32" ? "where" : "which";
  return spawnSync(finder, [bin], { stdio: "ignore" }).status === 0;
}

export const registerCommand = (name, server) =>
  server.type === "http"
    ? `claude mcp add --scope user --transport http ${name} ${server.url}`
    : `claude mcp add --scope user ${name} -- ${[server.command, ...(server.args ?? [])].join(" ")}`;

function registeredServers(claudeJson, cwd) {
  const config = readJson(claudeJson);
  const project = Object.entries(config.projects ?? {}).find(([key]) => normalize(key) === normalize(cwd))?.[1];
  return { ...config.mcpServers, ...project?.mcpServers, ...readJson(join(cwd, ".mcp.json")).mcpServers };
}

export function collectFacts({
  claudeDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"),
  claudeJson = process.env.CLAUDE_CONFIG_DIR ? join(process.env.CLAUDE_CONFIG_DIR, ".claude.json") : join(homedir(), ".claude.json"),
  cwd = process.cwd(),
  registry = readJson(REGISTRY),
  which = defaultWhich,
} = {}) {
  const match = AGENTS_IMPORT.exec(readText(join(claudeDir, "CLAUDE.md")));
  const importPath = match ? match[1].replace(/\\ /g, " ") : null;
  const registered = registeredServers(claudeJson, cwd);

  // Bundled servers ship with the plugin, so they are present whenever this code runs from it.
  const mcp = Object.entries(registry.servers ?? {}).filter(([, server]) => !server.bundled).map(([name, server]) => {
    const entry = registered[name];
    if (server.type === "http") {
      return { name, installed: true, registered: Boolean(entry), install: server.install ?? server.url, register: registerCommand(name, server) };
    }
    // A registration with an absolute command path proves the binary even when it is not on PATH.
    const registeredBinary = typeof entry?.command === "string" && /[\\/]/.test(entry.command) && existsSync(entry.command);
    return {
      name,
      installed: which(server.command) || registeredBinary,
      registered: Boolean(entry),
      install: server.install,
      register: registerCommand(name, server),
    };
  });

  return { importPath, importTargetExists: Boolean(importPath) && existsSync(importPath), mcp };
}

export function diagnose({ importPath, importTargetExists, mcp = [] }) {
  const problems = [];
  if (!importPath) {
    problems.push({
      id: "instructions-missing",
      message: "core/AGENTS.md is not imported in the user CLAUDE.md, so the kit's rules, orchestration and workflow are not active (only the plugin is installed).",
      fix: `Clone ${REPO_URL} and run \`node scripts/install.mjs\` from the clone.`,
    });
  } else if (!importTargetExists) {
    problems.push({
      id: "instructions-broken",
      message: `The user CLAUDE.md imports ${importPath}, which does not exist (the clone was moved or deleted).`,
      fix: "Run `node scripts/install.mjs` from the current jarvis-kit clone.",
    });
  }
  for (const server of mcp) {
    if (!server.installed) {
      problems.push({
        id: `mcp-missing:${server.name}`,
        message: `The required MCP server "${server.name}" is not installed.`,
        fix: `Install it (${server.install}), then run \`${server.register}\`.`,
      });
    } else if (!server.registered) {
      problems.push({
        id: `mcp-unregistered:${server.name}`,
        message: `The required MCP server "${server.name}" is installed but not registered.`,
        fix: `Run \`${server.register}\`.`,
      });
    }
  }
  return problems;
}

export function formatReport(problems) {
  if (!problems.length) return "";
  const lines = problems.map((p) => `- ${p.message} Fix: ${p.fix}`);
  return (
    "jarvis-kit setup is broken. Before anything else, tell the user what is missing and how to fix it, " +
    "and do not start the requested task until it is fixed or the user explicitly says to continue without it:\n" +
    lines.join("\n")
  );
}
