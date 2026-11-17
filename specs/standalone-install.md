# Install jarvis independently of the clone

Objective: the installed kit keeps working when the repo clone is moved or deleted; updates come from GitHub commits.
Status: done
Branch: master

## Specs
- S1: The plugin is installed from GitHub ("instalarlo desde GitHub"), not from the local clone.
  - Acceptance: the installer adds the marketplace from `matu2929/jarvis`; an existing `jarvis` marketplace with another source (the current local-directory install) is removed first, then re-added from GitHub.
- S2: Every pushed commit is an update ("Quitar `version` de `plugin.json`").
  - Acceptance: `.claude-plugin/plugin.json` has no `version`; re-running the installer refreshes the marketplace and runs `claude plugin update jarvis@jarvis`.
- S3: "Que el instalador copie `AGENTS.md` a `~/.claude/` y el import apunte a esa copia."
  - Acceptance: after install, `<claude-dir>/jarvis/AGENTS.md` equals `core/AGENTS.md` and the CLAUDE.md block imports that copy; `--uninstall` removes the block and the copy.
- S4: The doctor accepts the new import.
  - Acceptance: an import of `<claude-dir>/jarvis/AGENTS.md` that exists is healthy; the old `core/AGENTS.md` import is still recognized; fix messages no longer assume the clone stays in place.
- S6: The installed `AGENTS.md` matches the published plugin, not whatever the clone has (pending item from L3).
  - Acceptance: after the plugin step succeeds, the copy is taken from the installed plugin's `core/AGENTS.md` (`installPath` in `installed_plugins.json`); when the clone's `core/AGENTS.md` differs, the installer prints a warning. With `--skip-plugin` the clone's file is used. If the plugin step fails, the instructions are left untouched.
- S5: The README describes the new install and update flow (push, re-run the installer, new session).

## Out of scope
- A local/dev mode that loads the plugin from the clone.
- Turning on marketplace auto-update.
- Copying files other than `AGENTS.md`.

## Design
- `scripts/install.mjs`: copy `core/AGENTS.md` to `<claudeDir>/jarvis/AGENTS.md` and import it. Pure helper `pluginCommands(knownSource, uninstall)` returns the `claude` commands to run, so the migration logic is unit-tested; `knownSource` is read from `plugins/known_marketplaces.json` in the CLI config dir.
  - Install: if a `jarvis` marketplace exists and is not `github` `matu2929/jarvis`, `marketplace remove jarvis` (this also uninstalls the plugin, per the CLI docs). Then `marketplace add matu2929/jarvis`, `marketplace update jarvis`, `plugin install jarvis@jarvis`, `plugin update jarvis@jarvis` (each is a no-op when already in that state).
  - Uninstall: unchanged commands, plus removing the copy (the folder only if empty). Install stops at the first failing `claude` command and prints how to restore a removed local install; uninstall runs every step.
  - The marketplace source is read from `CLAUDE_CONFIG_DIR` or `~/.claude`, not `--claude-dir`.
- `adapters/claude/doctor.mjs`: import regex matches `.../AGENTS.md` inside the jarvis paths (`core/AGENTS.md` or `jarvis/AGENTS.md`); fix texts updated.
- Tradeoff: editing the clone no longer changes the running kit until pushed and re-installed.

## Tasks
| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1, S2, S3 | inline | done | install.test.mjs: pluginCommands cases, no plugin version, copy + import + uninstall keeps user files; 72/72 pass |
| T2 | S4 | inline | done | doctor.test.mjs: copy import healthy, legacy import, import outside block ignored, fix text |
| T3 | S5 | inline | done | README Install section updated |
| T4 | S6 | inline | done | install.test.mjs: publishedAgentsPath; reviewer recheck approved; 73/73 pass |

## Log
- L1 (2026-11-17): "dale, implementá la opción 1"
- L2 (2026-11-17): option 1 as agreed: "Quitar `version` de `plugin.json` e instalar el plugin desde GitHub. Que el instalador copie `AGENTS.md` a `~/.claude/` y el import apunte a esa copia."
- L3 (2026-11-17): review round: uninstall no longer deletes the whole folder, install stops on failure, marketplace source read from the CLI config dir, doctor matches only inside the marker block. Recheck approved. Open: no warning when the clone's AGENTS.md differs from origin.
- L4 (2026-11-17): "vamos por lo pendiente del instalador"
- L5 (2026-11-17): S6 done. The copy comes from the installed plugin; drift warns; a missing published copy falls back to the clone with exit code 1. Untested: agentsSource fallback and warning paths (only the pure helper is tested).
