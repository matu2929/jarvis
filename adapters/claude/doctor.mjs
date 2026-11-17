// Checks that jarvis-kit is fully installed for Claude Code.
// The plugin can be installed on its own (e.g. `claude plugin install`), which skips scripts/install.mjs,
// so the session-start hook and the installer both use this to report what is missing.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const REPO_URL = "https://github.com/matu2929/jarvis-kit";
const ENGRAM_URL = "https://github.com/Gentleman-Programming/engram";
const REGISTER_ENGRAM = "claude mcp add --scope user engram -- engram mcp";
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

function engramServers(claudeJson, cwd) {
  const config = readJson(claudeJson);
  const project = Object.entries(config.projects ?? {}).find(([key]) => normalize(key) === normalize(cwd))?.[1];
  const servers = { ...config.mcpServers, ...project?.mcpServers, ...readJson(join(cwd, ".mcp.json")).mcpServers };
  return Object.entries(servers).filter(([name]) => /engram/i.test(name)).map(([, server]) => server);
}

export function collectFacts({
  claudeDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"),
  claudeJson = process.env.CLAUDE_CONFIG_DIR ? join(process.env.CLAUDE_CONFIG_DIR, ".claude.json") : join(homedir(), ".claude.json"),
  cwd = process.cwd(),
  which = defaultWhich,
} = {}) {
  const match = AGENTS_IMPORT.exec(readText(join(claudeDir, "CLAUDE.md")));
  const importPath = match ? match[1].replace(/\\ /g, " ") : null;
  const servers = engramServers(claudeJson, cwd);
  const registeredBinaryExists = servers.some((s) => typeof s.command === "string" && /[\\/]/.test(s.command) && existsSync(s.command));

  return {
    importPath,
    importTargetExists: Boolean(importPath) && existsSync(importPath),
    engramInstalled: which("engram") || registeredBinaryExists,
    engramRegistered: servers.length > 0,
  };
}

export function diagnose({ importPath, importTargetExists, engramInstalled, engramRegistered }) {
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
  if (!engramInstalled) {
    problems.push({
      id: "engram-missing",
      message: "Engram is not installed, so persistent memory is off.",
      fix: `Install Engram (${ENGRAM_URL}), then run \`${REGISTER_ENGRAM}\`.`,
    });
  } else if (!engramRegistered) {
    problems.push({
      id: "engram-unregistered",
      message: "Engram is installed but not registered as an MCP server, so persistent memory is off.",
      fix: `Run \`${REGISTER_ENGRAM}\`.`,
    });
  }
  return problems;
}

export function formatReport(problems) {
  if (!problems.length) return "";
  const lines = problems.map((p) => `- ${p.message} Fix: ${p.fix}`);
  return `jarvis-kit setup is incomplete. Tell the user briefly at the start of your first reply:\n${lines.join("\n")}`;
}
