---
name: kickoff
description: Guided definition of a new project from scratch - an interview, one question at a time, through product, scope, architecture and conventions, writing the specs into the repo before any code, then handing off to the feature skill for a walking skeleton. Use when the user wants to start, create or bootstrap a new project, app or repository from zero, or to define an idea before coding it.
metadata:
  kit: jarvis
---

# Project kickoff

Take the user from an idea to a defined project. Guide proactively with best practices, but never decide for them: the user owns every decision, the AI proposes and explains.

## 1. Entry check

- If the folder has source files beyond scaffolding and config (a generator's starter files, `package.json`, a README, `.gitignore` do not count), say that `kickoff` is for new projects, recommend the `feature` skill, and stop.
- If any of `specs/product.md`, `specs/roadmap.md`, `specs/architecture.md` exist, or an `AGENTS.md` with a `Status:` line, read them, report which stages are done (a file whose `Status` is `approved`), skip the opening, and resume from the first incomplete stage. If `specs/product.md` has a `kickoff closed` entry under `## Changes`, kickoff is finished: recommend the `feature` skill and stop.
- An `AGENTS.md` without a `Status:` line was not written by kickoff: at the Conventions stage, merge into it and confirm before replacing any of its content.

## 2. Opening

In one short message, state:

- The five stages: Product, Scope, Architecture, Conventions, Close.
- That it takes roughly 15-25 questions, asked one at a time, more if the brainstorm produces many features.
- The escape hatches, usable at any moment: "I don't know", "you decide", "pause".

Then ask the first question.

## 3. Question protocol

These rules apply to every question in every stage.

- **One question at a time.** Ask, then stop and wait.
- **Propose instead of asking open-ended** whenever there is a sensible proposal: state it with its reason, so the user can answer "yes" or adjust it.
- **Options only on a real fork** with meaningful tradeoffs: 2-3 options, the recommended one first. Otherwise one proposal with "yes / adjust / explain it better or something else".
- **Always include the open option** ("explain it better or something else"), which continues the discussion in free text. It is the last option in both cases above.
- Use the agent's structured question tool if it has one; otherwise list the options numbered in text.
- **No silent assumptions.** Nothing is written to a project file unless the user confirmed it, including names and commands. When an answer is vague, ask for a concrete case before moving on.
- **"I don't know"**: switch to explain mode. Say what is at stake, what each path implies, and what an experienced engineer would choose and why. Ask again. If the user still cannot decide, record it as an open question (never as an assumption) in the `## Open questions` register of `specs/product.md`, with what it blocks: a stage, a feature, or the walking skeleton.
- **"You decide"**: give a proposal with its reason and ask for confirmation. Once confirmed, record it in the current stage's file marked `(proposed by AI, confirmed by user)`; in Architecture that is the ADR's `Proposed by` field.
- **"Pause"**: write only what is confirmed so far into the current stage's file, keep its `Status: draft`, and tell the user that running `kickoff` again resumes from there.

## 4. Stages

Create `specs/` if it is missing. Each stage ends with a checkpoint:

1. Show what you are about to write: the full text of the file, filled from its template, in the chat (never only its path or a summary).
2. On approval, write the file from its template in `templates/` (relative to this skill) and set `Status: approved`.
3. Never set `Status: approved` while an open question blocks that stage. Resolve it first, or get the user to narrow the stage so it no longer depends on it.

### 4.1 Product → `specs/product.md`

Cover, in this order: the project name, the problem, who has it (a concrete user, not "everyone"), why it is worth solving now, how success is measured, and what the product is explicitly not.

### 4.2 Scope → `specs/roadmap.md`

1. **Brainstorm.** Collect feature ideas freely; do not judge them yet.
2. **Cut the MVP.** For each candidate ask whether the product still validates its core idea without it. Propose a reduced version when a feature is only partly needed.
3. **Fill the table**, one line per feature: ID, feature, value (for whom, what it solves), phase (`MVP` / `Later`), dependencies, and whether it impacts architecture (auth, multi-tenancy, offline, payments, real time, heavy data, integrations).

Do not write per-feature specs. Detail is written later, by `feature`, when the item is built.

### 4.3 Architecture → `specs/architecture.md`

1. **Constraints**: where it runs, budget, team size and skills, compliance, deadlines.
2. **Architecture-impacting features**: explore only the roadmap items flagged as impacting architecture, enough to decide how the system supports them.
3. **Style and stack**: propose the architecture style and the stack with their reasons, tied to the constraints. Present the style from the user's global instructions as a proposal, never as a given. Check the current documentation of each library or framework with Context7 before asserting anything about it.
4. **ADRs**: record each confirmed decision as a short ADR. The architecture style is decided here, once.

If a decision here changes the scope, update `roadmap.md` only after the user confirms, and say so.

### 4.4 Conventions → `AGENTS.md`

Start from the user's global instructions (testing, commits, language). Show them as one batch of proposed project conventions and ask for confirmation; never apply them silently. Reference the architecture style from `specs/architecture.md` instead of deciding it again. Then ask about what differs for this project: folder structure, install, run, test and lint commands, branch and commit conventions. A command not known yet is an open question.

Some agent tools read only their own instructions file (for example, Claude Code versions without native `AGENTS.md` support read only `CLAUDE.md`). If the user's tool does, propose creating that file with a single line `@AGENTS.md`, so both share one source.

### 4.5 Close

- Show a one-screen summary: the problem, the MVP features, the stack, and the open questions with what they block.
- If an open question blocks the walking skeleton, do not hand off: resolve it with the user or narrow the skeleton so it no longer depends on it.
- Ask for explicit approval of the whole definition, then append `- <date>: kickoff closed` to the `## Changes` section of `specs/product.md`.
- Suggest a commit of the specs; commit only when the user asks.
- Hand off to the `feature` skill to build a walking skeleton: the thinnest end-to-end slice through every layer, with tests and CI running, before the first roadmap feature. The approved kickoff specs are its contract, and its `L1` is the user's approval of the definition, verbatim.

## 5. Changing earlier decisions

Adding to or resolving an entry in the open-questions register is not a change of decision and needs no extra confirmation. When a later stage contradicts an approved file, stop, show the conflict, and update the earlier file only after the user confirms. Append the change to that file's `Changes` section.
