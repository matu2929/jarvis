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

function checkPlugin() {
  const manifest = JSON.parse(readFileSync(join(ROOT, ".claude-plugin", "plugin.json"), "utf8"));
  const paths = [...[manifest.skills].flat(), ...[manifest.agents].flat(), ...[manifest.hooks].flat()].filter(Boolean);
  for (const path of paths) {
    if (!existsSync(join(ROOT, path))) fail("plugin.json", `path not found: ${path}`);
  }
  for (const path of [manifest.agents].flat()) {
    const fm = parseFrontmatter(readFileSync(join(ROOT, path), "utf8"));
    const expected = basename(path, ".md");
    if (!fm) fail(path, "missing frontmatter");
    else {
      if (fm.name !== expected) fail(path, `name "${fm.name}" must match the file name`);
      if (!fm.description) fail(path, "description is required");
    }
  }
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
