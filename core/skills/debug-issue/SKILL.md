---
name: debug-issue
description: Disciplined debugging - reproduce the failure, gather evidence, form falsifiable hypotheses, confirm the root cause, then fix it with a regression test written first. Use when the user reports a bug, an error, a failing test, or unexpected behavior.
metadata:
  kit: jarvis
---

# Debug issue

No fix before the root cause is confirmed. Fixing symptoms creates the next bug.

## 1. Reproduce

- Get the exact steps, input, environment, and the observed vs expected behavior.
- Reproduce it yourself. If the user reports a failure, reproduce it before deciding it already works.
- Reduce it to the smallest reproduction you can. Ideally, a failing test.
- If you cannot reproduce it, say so and ask for the missing information. Do not guess a fix.

## 2. Gather evidence

- Read the full error and stack trace; find the first frame in project code.
- Check recent changes: `git log -p -- <file>`, `git log -S '<symbol>'`, and `git bisect` when you know a good and a bad commit.
- Add temporary logging or use a debugger at the boundary where expected and actual first diverge.

## 3. Hypothesize and test

- Write down hypotheses that are falsifiable: "if X is the cause, then Y will happen when I do Z".
- Test one hypothesis at a time, cheapest first. Change one variable per experiment.
- Discard hypotheses the evidence refutes. Never stack several speculative changes.

## 4. Fix

- Write a regression test that fails because of the bug (RED).
- Fix the root cause, not the symptom (GREEN). Keep the fix minimal.
- Search for the same pattern elsewhere in the codebase; report other occurrences.
- Remove temporary logging.

## 5. Verify and report

- Run the regression test and the full suite.
- Report: root cause (with `file:line`), why it happened, the fix, the test that guards it, and the risk line: `Risk: item N (reason)` or `Risk: none`.
