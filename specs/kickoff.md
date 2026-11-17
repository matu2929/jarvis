# Kickoff skill: guided definition of a new project

Objective: a `kickoff` skill that proactively guides the user from an idea to a defined project (product, scope, architecture, conventions) with best practices, before any code is written, and then hands off to `feature`.
Status: in-progress
Branch: feat/kickoff-skill

## Specs

- S1: "Al momento de crear un projecto de cero, me gustaria tener una guia de como ir definiendo el projecto. Osea la IA deberia de forma proactiva ir guiandome con buenas practicas para ir definiendo el projecto de cero y luego que se ponga a codear."
  - Acceptance: the skill description triggers on starting a new project from scratch. In a folder with existing code it recommends `feature` instead and stops.
  - Acceptance: the skill runs five stages in order — Product, Scope, Architecture, Conventions, Close — and Close hands off to `feature` to build a walking skeleton.
  - Acceptance: the opening message states the stages, the approximate number of questions, and the escape hatches ("I don't know", "you decide", "pause").
- S2: "Me imagino algo como ir escribiendo especificaciones." / "las specs quiero que queden en el repo"
  - Acceptance: each stage ends with a checkpoint that writes its file in the project repo and shows a short summary for the user to approve or correct:
    - Product → `specs/product.md` (problem, users, why, success metrics, open questions)
    - Scope → `specs/roadmap.md`
    - Architecture → `specs/architecture.md` (constraints, stack, ADRs)
    - Conventions → project `AGENTS.md`
  - Acceptance: the skill ships templates for these four files.
- S3: Roadmap holds the feature list at one line per feature; detail is deferred to `feature` (agreed in conversation: "la lista de features donde se definirian? Se deberia de entrar en el detalle...").
  - Acceptance: `roadmap.md` is a table with columns ID, Feature, Value, Phase (MVP / Later), Depends on, Impacts architecture.
  - Acceptance: only features flagged "Impacts architecture" are explored further during kickoff, enough to record the stack decisions as ADRs. No per-feature spec is written during kickoff.
  - Acceptance: the Scope stage separates free brainstorming from a hard MVP cut, challenging each MVP candidate ("does the product work without it?").
- S4: "que la IA no asuma nada"
  - Acceptance: nothing is written to a project file without the user's confirmation. Proposals are allowed; silent assumptions are not.
  - Acceptance: "I don't know" switches to explain mode (what is at stake, what each path implies, what an experienced engineer would choose). If the user still cannot decide, it is recorded as an open question, never as an assumption, and blocks what depends on it.
  - Acceptance: "you decide" yields a proposal with its reason that the user confirms; the confirmed decision is recorded as an ADR marked as proposed by the AI.
  - Acceptance: defaults from the user's global profile (architecture style, testing, commits) are shown and confirmed in a batch at the Conventions stage, never applied silently.
- S5: "que este la posibilidad en las propuestas de respuesta que le da al usuario que una opcion sea texto libre para seguir debatiendo por si no tiene le conocimiento necesario el usuario"
  - Acceptance: every proposal includes an open option ("explain it better / something else") that continues the discussion in free text.
  - Acceptance: the skill uses the tool's structured question UI when it exists, otherwise numbered options in text, always with the open option.
  - Acceptance: consistent with `core/AGENTS.md`: one question at a time; 2–3 options plus the open one only on a real fork; otherwise a single proposal with "yes / adjust / explain".
- S6: The process can be paused and resumed (agreed in conversation).
  - Acceptance: on start, if kickoff files already exist, the skill reads them, reports which stages are done, and resumes from the first incomplete stage.
  - Acceptance: if a later stage changes an earlier decision (e.g. architecture changes scope), the skill updates the earlier file only after confirmation and says so.
- S7: `feature` links back to the roadmap.
  - Acceptance: when a `feature` spec implements a roadmap item, it references the roadmap ID, and closing it marks the item done in `roadmap.md`.

## Out of scope

- Adopting Spec Kit, BMAD, or Kiro, or any external CLI.
- Writing detailed per-feature specs during kickoff.
- Generating application code beyond handing off the walking skeleton to `feature`.
- Changes to `core/AGENTS.md` (the skill description is the trigger).
- Automated skill evals (can be added later with `skill-creator`).

## Design

- New skill `core/skills/kickoff/SKILL.md` (name not in the reserved list of `scripts/check.mjs`). Body: entry check, opening message, question protocol (S4, S5), the five stages with their checkpoint, resume logic, close and handoff.
- Templates in `core/skills/kickoff/templates/`: `product.md`, `roadmap.md`, `architecture.md`, `AGENTS.md`. The skill references them by relative path instead of inlining them, to keep `SKILL.md` focused.
- Question protocol, kept tool-agnostic: "use a structured question tool if the agent has one; otherwise numbered options in text". No Claude-specific tool names in `core/`.
- Architecture stage verifies stack claims with Context7 (required MCP), per `core/AGENTS.md`.
- Verified in T1 (Claude Code memory docs): recent Claude Code versions read `AGENTS.md` natively when there is no `CLAUDE.md`; older versions read only `CLAUDE.md`, and the documented bridge is a `CLAUDE.md` that imports `@AGENTS.md`. The Conventions stage proposes that bridge only when the user's tool needs it.
- Open questions live in one register in `specs/product.md` and block stage approval and the skeleton handoff when they apply.
- `feature` gets a small change for S7: step 3 template adds an optional `Roadmap: F#` line, and step 7 updates `specs/roadmap.md` when present.
- Docs and version: README Contents row, minor version bump in `.claude-plugin/plugin.json` and `package.json`.

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1, S4, S5, S6 | inline | done | `core/skills/kickoff/SKILL.md`; CLAUDE.md behavior verified against Claude Code docs |
| T2 | S2, S3 | inline | done | `core/skills/kickoff/templates/` (4 files) |
| T3 | S7 | inline | done | `core/skills/feature/SKILL.md` roadmap link |
| T4 | all | inline | in-progress | `npm test` 63/63, `npm run check` passed. Manual dry run pending: needs the user in a live session |
| T5 | all | delegated (code-reviewer) | done | Round 1: 1 blocker, 3 major, minors, all fixed. Recheck: 4 resolved; 1 new blocker (opening question count) fixed with the reviewer's suggested wording, plus 3 new minors fixed |

- T1: `SKILL.md` — entry check, opening, question protocol, stages, resume, close. Verify the CLAUDE.md assumption with docs.
- T2: the four templates.
- T3: `feature` roadmap link.
- T4: README row, version bump, `npm test` and `npm run check` pass; manual dry run of kickoff in an empty folder covering "I don't know", "you decide", pause and resume.
- T5: independent review against this spec.

## Log

- L1 (2026-11-17): "Tengo una idea para agregar a jarvis. Al momento de crear un projecto de cero, me gustaria tener una guia de como ir definiendo el projecto. Osea la IA deberia de forma proactiva ir guiandome con buenas practicas para ir definiendo el projecto de cero y luego que se ponga a codear. Me imagino algo como ir escribiendo especificaciones. Puede servir esto?  Dame alternativas si las consideras mejores y busca en internet si alguien ya hizo algo parecido para sacar ideas"
- L2 (2026-11-17): Option 2 chosen (own `kickoff` skill). Roadmap one line per feature; detail deferred to `feature`; architecture-impacting features explored during kickoff.
- L3 (2026-11-17): "las specs quiero que queden en el repo" / "me interesa profundizar en como seria la experiencia del usuario al hacer el kickoff". Five-stage flow with checkpoints agreed.
- L4 (2026-11-17): "Me gustaria agregar que la IA no asuma nada y que este la posibilidad en las propuestas de respuesta que le da al usuario que una opcion sea texto libre para seguir debatiendo por si no tiene le conocimiento necesario el usuario."
