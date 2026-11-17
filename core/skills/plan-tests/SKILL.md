---
name: plan-tests
description: Decide what to test and in what order - turn requirements into failing tests first, prioritize critical paths and business rules, add regression tests for touched behavior, and avoid low-value tests. Use before implementing a feature or fix, when writing tests, or when the user asks about test strategy or coverage.
metadata:
  kit: jarvis
---

# Plan tests

Tests prove behavior, not implementation. A test that cannot fail is worthless.

## 1. Find the runner

Detect the project's test runner and conventions (file naming, location, helpers, fixtures). Reuse them. If there is no runner, say so and propose the standard one for the stack before adding it.

## 2. Derive cases

For each requirement or acceptance criterion:

- One test per rule, asserting every observable effect: return value or output, errors and exit codes, persisted data, emitted events.
- The cases the rule itself names: valid, invalid, empty, boundaries.
- Through the public interface, never private internals.

For each existing behavior the change touches (shared functions, parsers, options, validation): one test proving the previous behavior still holds.

## 3. Prioritize

| Priority | What |
|---|---|
| 1 | Business rules and critical paths (money, auth, data integrity) |
| 2 | Error handling and edge cases the requirements name |
| 3 | Regression of touched existing behavior |
| 4 | Integration points (DB, HTTP, queues) with real or containerized dependencies when practical |
| Skip | Trivial getters, framework behavior, implementation details, snapshot-everything |

Prefer many fast unit tests, fewer integration tests, and few end-to-end tests on the critical journeys.

## 4. Test first

- Write the test, run it, and confirm it fails for the right reason (RED).
- Implement the minimum to pass (GREEN), then refactor with the tests green.
- If no runnable deterministic test is possible, explain why and define a manual or structural check instead. Never invent RED/GREEN evidence.

## 5. Keep tests healthy

- Deterministic: no real clock, randomness, network, or ordering dependence without control.
- Isolated: each test sets up its own state; scratch files go in a temp directory outside the repo.
- Readable: arrange / act / assert; the test name states the rule.

## Output

```
Runner: <command>
| # | Requirement | Case | Type | Priority |
|---|---|---|---|---|
| 1 | S1 | rejects empty email with "Email is required" | unit | 1 |
```
