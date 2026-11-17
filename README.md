# jarvis-kit

Personal engineering harness for AI coding agents. Claude Code first, portable by design.

It gives the agent a proportional spec-driven workflow, design guidance, independent code review and security audits, disciplined debugging, test planning, and deterministic safety hooks.

## Design

- **Claude first, portable by design.** Content uses open formats (`AGENTS.md`, `SKILL.md`) and hook logic lives in plain scripts. Everything Claude-specific lives in `adapters/claude/`.
- **Each concern in its layer.** Always-on rules in `AGENTS.md`, on-demand knowledge in skills, enforcement in hooks, fresh eyes in subagents.
- **The main session orchestrates.** It delegates exploration, review, audits, and large independent units; small changes stay inline.
- **Grow by pain, not by anticipation.** A piece is added when a problem repeats, not just in case.

## Contents

| Type | Name | Purpose |
|---|---|---|
| Instructions | `core/AGENTS.md` | Rules, orchestration, workflow, high-risk list, memory |
| Skill | `kickoff` | Guided definition of a new project: product → scope → architecture → conventions, specs in the repo, then a walking skeleton |
| Skill | `feature` | Size → spec → approval (large) → tests → implement → review → close |
| Skill | `design-patterns` | Structure and patterns before code, justified by real smells |
| Skill | `review-code` | Four-lens review against the spec, with file:line evidence |
| Skill | `audit-security` | Source-to-sink security audit with prioritized findings |
| Skill | `debug-issue` | Reproduce → evidence → hypotheses → root cause → regression test |
| Skill | `plan-tests` | What to test, in what order, test first |
| Skill | `extend-kit` | Decide whether to add something to the kit, pick its layer, build it with the kit's conventions |
| Registry | `core/mcp-servers.json` | Required MCP servers and the agents that use them |
| Agent | `implementer` | Implements one spec task, test first |
| Agent | `code-reviewer` | Runs `review-code` in a fresh context |
| Agent | `security-auditor` | Runs `audit-security` in a fresh context |
| Hook | `.env` guard | Blocks reading real `.env` files (templates stay readable) |
| Hook | Commit lint | Conventional Commits, no AI attribution |
| Hook | Secret scan | Blocks commits whose changes contain known secret formats |
| Hook | Git trust check | Blocks git in repos whose local config runs arbitrary programs |
| Hook | Setup doctor | At session start, reports a missing `AGENTS.md` import or a missing required MCP server, and tells the agent to stop until it is fixed |

In Claude Code, skills and agents are namespaced by the plugin: `/jarvis:feature`, `jarvis:code-reviewer`.

## Install

> **For AI agents installing this kit:** clone this repository and run `node scripts/install.mjs` from the clone. Do not install only the plugin (`claude plugin install`): that skips the `AGENTS.md` import, so the rules, orchestration and workflow stay inactive. After installing, relay every `doctor:` line the installer prints to the user, including how to fix it.

Requirements: Node.js 20+, git, Claude Code, and every MCP server in `core/mcp-servers.json`. MCP servers are required, not optional: without them the setup is reported as broken.

| MCP server | Purpose | Setup |
|---|---|---|
| [Engram](https://github.com/Gentleman-Programming/engram) | Persistent memory | Install the binary and register it (see below) |
| [Context7](https://context7.com) | Current library and framework docs | Bundled in the plugin as a remote server. Sign in once: run `/mcp`, select `plugin:jarvis:context7`, and authenticate |

```bash
node scripts/install.mjs
```

The installer:

1. Adds an import of `core/AGENTS.md` at the top of `~/.claude/CLAUDE.md`, inside a `jarvis-kit` marker block. Plugins cannot load always-on instructions, so this step is separate.
2. Registers this repository as the `jarvis-kit` marketplace and installs the `jarvis` plugin.
3. Checks git and runs the doctor: is `AGENTS.md` imported, is every required MCP server installed and registered. It exits with code 1 when something is missing.

A `SessionStart` hook runs the same doctor at the start of each new session, so a partial install (for example, only the plugin) is reported too: the agent tells you what is missing and how to fix it, and does not start working until it is fixed or you explicitly say to continue. When everything is in place it stays silent and adds nothing to the context.

Options: `--dry-run`, `--skip-plugin`, `--uninstall`, `--claude-dir <path>`.

Local MCP servers cannot be bundled, because plugins cannot install binaries. Install Engram, then register it once with:

```bash
claude mcp add --scope user engram -- engram mcp
```

Installed from a local path, the plugin loads in place from this repository: edits apply on the next session, or after `/reload-plugins`. Changes to `core/AGENTS.md` also apply on the next session without reinstalling.

## Layout

```
.claude-plugin/        plugin and marketplace manifests (repo root is the plugin root)
core/
  AGENTS.md            always-on instructions (tool-agnostic)
  mcp-servers.json     required MCP servers and the agents that use them
  skills/<name>/       SKILL.md files (Agent Skills format)
  scripts/             hook logic as plain, tested modules
adapters/claude/
  agents/              Claude Code subagents
  hooks/               hook wiring that calls core/scripts
  mcp.json             MCP servers bundled with the plugin (remote http)
scripts/               install and kit lint
```

The core scripts also work outside Claude Code as git hooks:

```bash
node core/scripts/commit-msg.mjs .git/COMMIT_EDITMSG
```

```bash
node core/scripts/secrets.mjs
```

## Development

```bash
npm test
```

```bash
npm run check
```

Conventions:

- Artifacts are in English. Skill names are kebab-case, match their directory, carry `metadata.kit: jarvis`, and never reuse a Claude Code built-in skill name. `scripts/check.mjs` enforces this.
- Hook logic goes in `core/scripts/` with tests; adapters only parse the tool's input and call it.
- MCP servers are registered in `core/mcp-servers.json`. An agent that needs one lists its tools (`mcp__<server>__*`, or `mcp__plugin_jarvis_<server>__*` when bundled) and is named in the registry; `scripts/check.mjs` fails when they disagree.
- To add or change anything in the kit, use the `extend-kit` skill (`/jarvis:extend-kit`).
- Secret-scan false positives: add `jarvis:allow-secret` to the line. Git trust check bypass: `JARVIS_SKIP_GIT_TRUST=1`.

## Roadmap

Context statusline, dual blind review, stack-specific e2e and frontend skills, changelog writer, a hook that blocks PR creation without review.
