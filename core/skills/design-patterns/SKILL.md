---
name: design-patterns
description: Architecture and design-pattern guidance before writing code - choose structure (hexagonal, clean, screaming architecture), apply SOLID and the dependency rule, pick GoF patterns only when a real smell calls for them, and structure UI with container-presentational and atomic design. Use when designing a module, feature, or refactor, or when code shows coupling, duplication, or unclear boundaries.
metadata:
  kit: jarvis
---

# Design patterns

Design before code. The goal is code that is easy to change, not code that uses many patterns.

## 1. Respect what exists

- Read the project structure first. If the project already follows a pattern, extend it consistently even if you would choose differently.
- Propose a structural change only when the current structure is causing a concrete problem. Name the problem.

## 2. Choose the structure by need

| Situation | Structure |
|---|---|
| Script, small CLI, prototype | Flat and simple. No layers |
| Business logic that must outlive frameworks, multiple adapters (HTTP, CLI, queue, DB) | Hexagonal (ports and adapters) |
| Large app with many features | Screaming architecture: folders by feature/domain, not by technical type |
| Complex domain rules | Clean architecture layers: domain → application → infrastructure |

### Dependency rule

Dependencies point inward. Domain code never imports frameworks, databases, or HTTP. Infrastructure implements interfaces (ports) defined by the inner layers.

```
infrastructure ──▶ application ──▶ domain
(adapters)         (use cases)     (entities, rules, ports)
```

## 3. Principles to check

- Single responsibility: one reason to change per module.
- Depend on abstractions at boundaries (I/O, external services), not everywhere.
- Composition over inheritance.
- Make illegal states unrepresentable with types where the language allows it.
- Pure functions for business rules; side effects at the edges.
- YAGNI: no abstraction until there are two real variations or a real boundary.

## 4. GoF patterns: smell → pattern

Apply a pattern only when its smell is present.

| Smell | Pattern |
|---|---|
| Growing `if/switch` on a type or mode to choose behavior | Strategy |
| Complex or conditional object creation scattered around | Factory |
| Third-party or legacy API that does not fit your interface | Adapter |
| Adding behavior (logging, caching, retries) without touching the core | Decorator |
| Many consumers must react to a change | Observer / events |
| Data access logic mixed with business logic | Repository |
| Many optional constructor parameters | Builder |
| One operation needs undo, queueing, or logging | Command |

## 5. UI structure

- Container-presentational: containers own data, state, and effects; presentational components receive props and render. Presentational components never fetch.
- Atomic design for shared UI: atoms → molecules → organisms → templates → pages. Keep feature-specific components inside the feature folder.

## Output

Before implementing, deliver:

1. The proposed structure (folders, modules, main interfaces).
2. Which patterns apply and the smell that justifies each.
3. Tradeoffs and the simpler alternative you rejected.

Keep it short. If the change is small, say "no structural change needed" and move on.
