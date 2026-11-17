---
name: review-code
description: Independent code review of a diff against its contract (spec or request) through four lenses - risk, resilience, readability, reliability - with mandatory file:line evidence and severity. Use after implementing a change, before a commit or PR, or when the user asks to review code.
metadata:
  kit: jarvis
---

# Review code

## Inputs

- The diff, pinned to a commit SHA or range (`git diff <base>..<sha>`), or the staged/working diff when nothing is committed. Record what you reviewed.
- The contract: the spec (`specs/<slug>.md`) or the user's original request.
- Never the implementer's reasoning or chat history. Judge the artifact against the contract only.

When the tool supports subagents, run the review in a fresh context. Whoever wrote the code does not review it.

## Lenses

Apply every lens that the change touches.

**Risk** — security and data
- Untrusted input reaching queries, shell, file paths, templates, or deserializers.
- Missing authorization checks; secrets in code or logs; sensitive data exposure.
- Changes to stored data, persisted formats, or public contracts.

**Resilience** — behavior under failure
- Errors swallowed or turned into wrong success; missing timeouts; unbounded retries.
- Partial writes without rollback; resources not released; race conditions.

**Readability** — what others read and depend on
- Names that do not reveal intent; functions doing several things; dead code.
- Inconsistency with the project's existing patterns; leaking abstractions.
- Public API, messages, or docs that are unclear or out of date.

**Reliability** — tests and correctness
- Every spec requirement has a test that would fail without the change.
- Edge cases the contract names: empty, null, boundaries, invalid input.
- Tests through the public interface, deterministic, asserting observable effects.

## Findings

Every finding needs `file:line`, what is wrong, why it matters, and how to reproduce or a concrete scenario. A finding without evidence is not blocking.

| Severity | Meaning |
|---|---|
| blocker | Caused by this change, reproducible, breaks the contract, security, or data |
| major | Real defect or missing test for a requirement, not immediately harmful |
| minor | Maintainability or clarity issue |
| nit | Style preference; never blocks |

Classify causality: `caused` (introduced by this diff) or `pre-existing` (already at the base). Pre-existing issues are follow-ups, never blockers.

Silently ignoring an explicit option, or changing existing output nobody asked to change, is always a blocker.

## Output

```
Reviewed: <base>..<sha> against <spec or request>
Verdict: APPROVED | CHANGES REQUIRED

Blockers
- [caused] path/file.ext:42 — <issue>. Scenario: <repro>. Fix: <suggestion>

Major / Minor / Nits
- ...

Spec coverage: S1 ✅ S2 ❌ (no test for <case>)
```

The review reports; it does not edit code. One correction round follows, then a recheck limited to the reported blockers.
