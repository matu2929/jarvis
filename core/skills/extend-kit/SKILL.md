---
name: extend-kit
description: Decide whether and how to extend jarvis-kit - choose the right layer (skill, hook, agent, AGENTS.md rule, or MCP server) and add it following the kit's conventions, tests and checks. Use when the user wants to add, change, or remove a skill, hook, agent, rule, or MCP server in the kit, or asks whether something is worth adding.
metadata:
  kit: jarvis
---

# Extend the kit

Work inside the jarvis-kit repository. Read `README.md` first for the current contents and layout.

## 1. Should it exist?

Answer before building anything:

- **Pain**: what concrete problem does it solve, and has it happened at least twice? "Just in case" is a no.
- **Overlap**: does an existing piece already cover it? Prefer extending that piece over adding a new one.
- **Cost**: always-on content (AGENTS.md, skill descriptions) costs context in every session. Is the benefit worth it?

If the answer is not clearly yes, say so and stop. Recommending not to add something is a valid outcome.

## 2. Choose the layer

| Need | Layer |
|---|---|
| Must happen every time, regardless of what the model decides | Hook |
| Knowledge or a procedure needed only for some tasks | Skill |
| Heavy or independent work, or fresh eyes without author bias | Agent that follows a skill |
| A short rule that applies to every task | `core/AGENTS.md` |
| Access to an external system: API, database, docs, browser | MCP server |

When two layers seem to fit, prefer the one that costs less context and is more deterministic: hook > skill > AGENTS.md.

## 3. Build it

### Skill

- Create `core/skills/<name>/SKILL.md`. The name is kebab-case, matches the directory, and does not reuse a Claude Code built-in skill name (`scripts/check.mjs` keeps the reserved list).
- Frontmatter: `name`, `description`, and `metadata.kit: jarvis`. The description says what it does AND when to use it, since it decides when the skill triggers.
- Body: imperative steps, a concrete output format, no filler. Keep it focused on one job.
- For a complex skill, the built-in `skill-creator` can help refine the wording and run evals.

### Hook

- Put the logic in `core/scripts/<name>.mjs` as pure, exported functions with a `<name>.test.mjs` next to it. Write the tests first.
- Wire it in `adapters/claude/hooks/`: reuse `pre-tool-use.mjs` for PreToolUse checks, or add a handler and register it in `hooks/hooks.json` with exec form (`"command": "node"`, `"args": [...]`).
- Exit code 2 blocks the tool call and shows stderr to the model. Any internal error must exit non-blocking (code 1).
- Add an integration test that runs the hook with a JSON input, like `pre-tool-use.test.mjs`.

### Agent

- Create `adapters/claude/agents/<name>.md` with `name`, `description`, and an explicit `tools` allowlist.
- Point the body to the skill it follows through `${CLAUDE_PLUGIN_ROOT}/core/skills/<skill>/SKILL.md` instead of copying its content.
- Register the file in `.claude-plugin/plugin.json` under `agents` (directories are not accepted, list each file).
- An agent never reviews work it wrote.

### AGENTS.md rule

- Add it to the matching section of `core/AGENTS.md`. One or two lines; move anything longer to a skill.

### MCP server

MCP servers are required, never optional: a missing server must break the setup loudly.

Pick the transport first. Check the server's code or docs: a "local" server that only proxies a cloud API gives no offline benefit and runs third-party code on the machine.

| Transport | When | Registry fields |
|---|---|---|
| Remote http, bundled | The server has a hosted endpoint. Preferred: nothing to install; use OAuth when offered so no secret is stored | `type: "http"`, `url`, `bundled: true` |
| Remote http, user-registered | Hosted, but it needs per-user config the plugin cannot carry | `type: "http"`, `url`, `install` |
| Local stdio | It must run locally (local data, a binary) | `command`, `args`, `install` |

1. Add it to `core/mcp-servers.json` with `purpose`, the transport fields above, and the `agents` that need it. A bundled server also goes in `adapters/claude/mcp.json` with the same `url`.
2. For each agent listed there, add the server's tools to its `tools`: `mcp__<server>__*`, or `mcp__plugin_jarvis_<server>__*` for a bundled server. With a `tools` allowlist an agent sees no MCP tools unless they are listed. `scripts/check.mjs` fails if an agent, the registry, and the bundled config disagree.
3. Skills use its tools directly. Never write "if available": the doctor already reports a missing server.
4. Hooks that react to its tools match the full tool name (`mcp__<server>__<tool>`); a matcher with only the server name never fires.
5. The doctor (`adapters/claude/doctor.mjs`) reads the registry, so the session-start warning and the installer check non-bundled servers without extra code. Bundled servers ship with the plugin.
6. Add it to the README requirements, including any one-time sign-in (OAuth through `/mcp`).

## 4. Verify

Run all of these and report the observed results:

```bash
npm test
```

```bash
npm run check
```

When the piece changes runtime behavior (a hook, an agent, an MCP), also check it in a live session: run `/reload-plugins` or start a new session and trigger it once.

## 5. Document and version

- Update the Contents table in `README.md`, and the Roadmap if this item was on it.
- Bump the version in `.claude-plugin/plugin.json` and `package.json` together: minor for a new piece, patch for a fix.
- Commit with a Conventional Commit message only when the user asks.
