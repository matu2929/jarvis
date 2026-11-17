// Installs jarvis for Claude Code:
//   1. Adds the GitHub repo as the `jarvis` plugin marketplace, installs the plugin, and updates both.
//      A `jarvis` marketplace from another source (an older install from the local clone) is replaced.
//   2. Copies the installed plugin's core/AGENTS.md to <claude-dir>/jarvis/AGENTS.md and imports that copy
//      from the user-level CLAUDE.md (plugins cannot load always-on instructions). Taking it from the
//      plugin keeps the rules in step with the published kit; the copy keeps working without the clone.
//   3. Checks requirements: git, and the doctor checks (instructions import, every required MCP server in
//      core/mcp-servers.json installed and registered). Exits with code 1 when the setup is broken.
//
// Usage: node scripts/install.mjs [--uninstall] [--dry-run] [--skip-plugin] [--claude-dir <path>]
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectFacts, diagnose } from "../adapters/claude/doctor.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MARKETPLACE = "jarvis";
const PLUGIN = "jarvis@jarvis";
const GITHUB_REPO = "matu2929/jarvis";
const START = "<!-- jarvis:start -->";
const END = "<!-- jarvis:end -->";
// Also matches the block written before the repo was renamed from jarvis-kit, so reinstalling replaces it.
const BLOCK = /<!-- jarvis(?:-kit)?:start -->[\s\S]*?<!-- jarvis(?:-kit)?:end -->\r?\n?/;

function parseArgs(argv) {
  const options = { uninstall: false, dryRun: false, skipPlugin: false, claudeDir: join(homedir(), ".claude") };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--uninstall") options.uninstall = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--skip-plugin") options.skipPlugin = true;
    else if (arg === "--claude-dir") options.claudeDir = resolve(argv[++i]);
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

// CLAUDE.md imports use forward slashes and escape spaces with a backslash.
export const importLine = (path) => `@${path.replace(/\\/g, "/").replace(/ /g, "\\ ")}`;

export function withInstructions(content, agentsPath) {
  const block = `${START}\n${importLine(agentsPath)}\n${END}\n`;
  if (BLOCK.test(content)) return content.replace(BLOCK, block);
  return content.trim() ? `${block}\n${content}` : block;
}

export const withoutInstructions = (content) => content.replace(BLOCK, "").replace(/^\s*\n/, "");

const CLONE_AGENTS = join(REPO_ROOT, "core", "AGENTS.md");

// `installed` is the parsed installed_plugins.json; the user-scope install is the one this script makes.
export function publishedAgentsPath(installed) {
  const install = installed?.plugins?.[PLUGIN]?.find((entry) => entry.scope === "user");
  return install?.installPath ? join(install.installPath, "core", "AGENTS.md") : undefined;
}

const configDir = () => process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
const readJsonFile = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
};

// The published copy when the plugin was installed; the clone's file otherwise (--skip-plugin, --dry-run).
function agentsSource({ skipPlugin, dryRun }) {
  if (skipPlugin || dryRun) return CLONE_AGENTS;
  const published = publishedAgentsPath(readJsonFile(join(configDir(), "plugins", "installed_plugins.json")));
  if (!published || !existsSync(published)) {
    console.error("instructions: ERROR the installed plugin's AGENTS.md was not found; using this clone's core/AGENTS.md");
    process.exitCode = 1;
    return CLONE_AGENTS;
  }
  if (readFileSync(published, "utf8") !== readFileSync(CLONE_AGENTS, "utf8")) {
    console.warn(
      "instructions: WARNING this clone's core/AGENTS.md differs from the published one, which was installed. " +
        "If the clone has the version you want, commit and push it, then run the installer again.",
    );
  }
  return published;
}

function updateInstructions({ claudeDir, uninstall, dryRun }, source = CLONE_AGENTS) {
  const copyDir = join(claudeDir, "jarvis");
  const copy = join(copyDir, "AGENTS.md");
  if (dryRun) console.log(`instructions: would ${uninstall ? "remove" : "copy core/AGENTS.md to"} ${copy}`);
  else if (uninstall) {
    // Remove only the file the installer wrote; the folder may hold user files (even a clone).
    rmSync(copy, { force: true });
    try {
      rmdirSync(copyDir);
    } catch {
      // Not empty or missing: leave it.
    }
  } else {
    mkdirSync(copyDir, { recursive: true });
    copyFileSync(source, copy);
    console.log(`instructions: copied ${source} to ${copy}`);
  }

  const file = join(claudeDir, "CLAUDE.md");
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  const next = uninstall ? withoutInstructions(current) : withInstructions(current, copy);
  if (next === current) return console.log(`instructions: ${file} already up to date`);
  if (dryRun) return console.log(`instructions: would update ${file}`);
  writeFileSync(file, next);
  console.log(`instructions: ${uninstall ? "removed import from" : "imported the copy in"} ${file}`);
}

function claude(args, dryRun) {
  const printable = `claude ${args.join(" ")}`;
  if (dryRun) return console.log(`plugin: would run ${printable}`);
  // `claude` is an npm shim on Windows (.cmd), which needs a shell to spawn.
  const quoted = args.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a));
  const result = spawnSync(`claude ${quoted.join(" ")}`, { stdio: "inherit", shell: true });
  if (result.status !== 0) console.error(`plugin: "${printable}" exited with ${result.status}`);
  return result.status === 0;
}

// `known` is the current `jarvis` entry's source in known_marketplaces.json, if any.
// Removing a marketplace also uninstalls its plugins, so the plugin is installed again right after.
export function pluginCommands(known, uninstall = false) {
  if (uninstall) return [["plugin", "uninstall", PLUGIN], ["plugin", "marketplace", "remove", MARKETPLACE]];
  const fromGitHub = known?.source === "github" && known.repo === GITHUB_REPO;
  return [
    ...(known && !fromGitHub ? [["plugin", "marketplace", "remove", MARKETPLACE]] : []),
    ["plugin", "marketplace", "add", GITHUB_REPO],
    ["plugin", "marketplace", "update", MARKETPLACE],
    ["plugin", "install", PLUGIN],
    ["plugin", "update", PLUGIN],
  ];
}

// Read from the config dir the `claude` CLI uses, which --claude-dir does not change.
const knownSource = () => readJsonFile(join(configDir(), "plugins", "known_marketplaces.json"))?.[MARKETPLACE]?.source;

// Install stops at the first failure: after a `marketplace remove`, going on would hide that the plugin is gone.
// Uninstall runs every step, so a plugin already removed by hand does not leave the marketplace behind.
function updatePlugin({ uninstall, dryRun }) {
  const known = knownSource();
  if (uninstall) {
    const results = pluginCommands(known, true).map((args) => claude(args, dryRun));
    if (results.includes(false)) process.exitCode = 1;
    return true;
  }
  for (const args of pluginCommands(known)) {
    if (claude(args, dryRun) !== false) continue;
    process.exitCode = 1;
    if (!args.includes("remove") && known?.source === "directory") {
      console.error(`plugin: the previous local install was removed. To restore it: claude plugin marketplace add "${known.path}" && claude plugin install ${PLUGIN}`);
    }
    return false;
  }
  return true;
}

function checkRequirements({ claudeDir, dryRun }) {
  const finder = process.platform === "win32" ? "where" : "which";
  const gitFound = spawnSync(finder, ["git"], { stdio: "ignore" }).status === 0;
  console.log(`requirement: git ${gitFound ? "found" : "NOT FOUND (required by the git hooks)"}`);

  // A dry run did not write the import yet, so only report the optional pieces.
  const problems = diagnose(collectFacts({ claudeDir })).filter((p) => !(dryRun && p.id.startsWith("instructions")));
  for (const problem of problems) console.error(`doctor: ERROR ${problem.message}\n        Fix: ${problem.fix}`);
  if (problems.length) process.exitCode = 1;
  else console.log("doctor: setup complete");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  if (options.uninstall) {
    updateInstructions(options);
    if (!options.skipPlugin) updatePlugin(options);
  } else if (options.skipPlugin || updatePlugin(options)) {
    // A failed plugin step leaves the instructions as they were.
    updateInstructions(options, agentsSource(options));
    checkRequirements(options);
  }
}
