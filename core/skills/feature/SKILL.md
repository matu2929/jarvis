---
name: feature
description: End-to-end workflow for building a feature or any non-trivial change - size it, write a proportional spec, get approval when large, test first, implement, review against the spec, and close. Use when the user asks to build, add, implement, or change functionality beyond a one-line fix.
metadata:
  kit: jarvis
---

# Feature workflow

Spec-driven, proportional to size. The spec is the contract: the implementer builds against it and the reviewer reviews against it.

## 1. Understand

- Explore the relevant code before proposing anything. Follow the existing patterns of the project.
- Check the current documentation of the libraries and frameworks involved with Context7, for the versions the project uses.
- If a real product decision is open, ask ONE focused question and stop.

## 2. Size with the resume test

Could someone finish this from the original request and `git diff` alone?

| Size | When | Spec |
|---|---|---|
| Small | Passes the resume test | None. Go to step 4 |
| Medium | One bounded feature, one session | Short spec file |
| Large | Several sessions, several pieces, or requirements too long to keep in mind | Full spec file + explicit approval |

Never size by counting files or lines.

## 3. Spec

Write it at `specs/<slug>.md` in the project (create `specs/` if missing). Use the template below. Medium specs keep only the sections marked (M).

Rules:

- Requirements quote the user's exact words, error messages, and examples verbatim. Never paraphrase, never add requirements the user did not ask for. Mark assumptions as assumptions.
- `L1` in the log is the user's original request, verbatim.
- A requirement change appends a verbatim log entry, rewrites only the affected `S#`, and reopens only its task.
- Large: show the spec and get explicit approval before step 4. Medium: share it and continue.

```markdown
# <Feature title>

Objective: <one line> (M)
Status: draft | approved | in-progress | done
Branch: <branch>

## Specs (M)
- S1: <requirement, user wording verbatim>
  - Acceptance: <observable, testable criterion>

## Out of scope (M)
- <what this change will not do>

## Design
<approach, affected modules, patterns, tradeoffs>

## Tasks
| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1 | inline / delegated | todo | <commit or test result> |

## Log (M)
- L1 (<date>): "<original request verbatim>"
```

## 4. Tests first

Use the `plan-tests` skill. Turn each acceptance criterion into a failing test (RED) before implementing, whenever a runnable deterministic test is possible. If not possible, say why and define the manual check.

## 5. Implement

- Small and medium: implement inline.
- Large: one task at a time. Delegate a task to an implementer subagent only when it is large and independent or when several tasks can run in parallel on disjoint files. Hand off by reference: `Spec: specs/<slug>.md, T2, S3-S4. Read the spec up to ## Log.`
- Check a task off only after its tests pass. Record the evidence in the task table.

## 6. Review

- Review against the spec with the `review-code` skill, in a fresh context (subagent) when the tool supports it. The reviewer receives the diff (commit SHA or range) and the spec, never the implementer's reasoning.
- If the change touches a high-risk item (see global instructions), also run `audit-security` when item 2 applies.
- One correction round for blocking findings, then a recheck of only those findings. If anything is still blocking, stop and escalate to the user.

## 7. Close

- Verify every `S#` has evidence. Run the full test suite once.
- Set the spec status to `done` and append the final log entry.
- Report: what was done, checks run with their results, anything skipped or pending, and the risk line: `Risk: item N (reason)` or `Risk: none`.
- Commit only when the user asks.
