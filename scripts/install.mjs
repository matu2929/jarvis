// Installs jarvis-kit for Claude Code:
//   1. Imports core/AGENTS.md from the user-level CLAUDE.md (plugins cannot load always-on instructions).
//   2. Registers this repo as a plugin marketplace and installs the `jarvis` plugin.
//   3. Checks requirements: git, and the doctor checks (instructions import, Engram installed and registered).
//
// Usage: node scripts/install.mjs [--uninstall] [--dry-run] [--skip-plugin] [--claude-dir <path>]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectFacts, diagnose } from "../adapters/claude/doctor.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MARKETPLACE = "jarvis-kit";
const PLUGIN = "jarvis@jarvis-kit";
const START = "<!-- jarvis-kit:start -->";
const END = "<!-- jarvis-kit:end -->";
const BLOCK = new RegExp(`${START}[\\s\\S]*?${END}\\r?\\n?`);

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

function updateInstructions({ claudeDir, uninstall, dryRun }) {
  const file = join(claudeDir, "CLAUDE.md");
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  const next = uninstall ? withoutInstructions(current) : withInstructions(current, join(REPO_ROOT, "core", "AGENTS.md"));
  if (next === current) return console.log(`instructions: ${file} already up to date`);
  if (dryRun) return console.log(`instructions: would update ${file}`);
  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(file, next);
  console.log(`instructions: ${uninstall ? "removed import from" : "imported core/AGENTS.md in"} ${file}`);
}

function claude(args, dryRun) {
  const printable = `claude ${args.join(" ")}`;
  if (dryRun) return console.log(`plugin: would run ${printable}`);
  // `claude` is an npm shim on Windows (.cmd), which needs a shell to spawn.
  const quoted = args.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a));
  const result = spawnSync(`claude ${quoted.join(" ")}`, { stdio: "inherit", shell: true });
  if (result.status !== 0) console.warn(`plugin: "${printable}" exited with ${result.status}`);
}

function updatePlugin({ uninstall, dryRun }) {
  if (uninstall) {
    claude(["plugin", "uninstall", PLUGIN], dryRun);
    claude(["plugin", "marketplace", "remove", MARKETPLACE], dryRun);
  } else {
    claude(["plugin", "marketplace", "add", REPO_ROOT], dryRun);
    claude(["plugin", "install", PLUGIN], dryRun);
  }
}

function checkRequirements({ claudeDir, dryRun }) {
  const finder = process.platform === "win32" ? "where" : "which";
  const gitFound = spawnSync(finder, ["git"], { stdio: "ignore" }).status === 0;
  console.log(`requirement: git ${gitFound ? "found" : "NOT FOUND (required by the git hooks)"}`);

  // A dry run did not write the import yet, so only report the optional pieces.
  const problems = diagnose(collectFacts({ claudeDir })).filter((p) => !(dryRun && p.id.startsWith("instructions")));
  for (const problem of problems) console.log(`doctor: ${problem.message}\n        Fix: ${problem.fix}`);
  if (!problems.length) console.log("doctor: setup complete");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  updateInstructions(options);
  if (!options.skipPlugin) updatePlugin(options);
  if (!options.uninstall) checkRequirements(options);
}
