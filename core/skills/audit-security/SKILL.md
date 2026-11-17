---
name: audit-security
description: Security audit of a diff or module - injection, auth and authorization, secrets, input validation, path traversal, SSRF, XSS, unsafe deserialization, weak crypto, and dependency risks - with prioritized, evidence-backed findings. Use when a change touches auth, permissions, credentials, untrusted input, or external calls, or when the user asks for a security review.
metadata:
  kit: jarvis
---

# Audit security

Report only. Do not edit code. When the tool supports subagents, run the audit in a fresh context.

## Scope

State what you audit: a diff pinned to a commit SHA or range, or a named module. Map the trust boundaries first: where untrusted data enters (HTTP, CLI args, files, env, queues, third-party APIs) and where it ends up (DB, shell, filesystem, HTML, logs, outbound requests).

## Checklist

Follow untrusted data from each entry point to each sink.

| Category | Look for |
|---|---|
| Injection | String-built SQL/NoSQL queries, shell commands, LDAP, template rendering with user input |
| AuthN / AuthZ | Missing or client-side-only checks, IDOR (object access by ID without ownership check), privilege escalation, broken session handling |
| Secrets | Hardcoded keys or passwords, secrets in logs, errors, URLs, or client bundles |
| Input validation | Missing type, length, range, or format checks at the boundary; trusting client-provided IDs or roles |
| Path traversal | User input in file paths without normalization and containment check |
| SSRF | User-controlled URLs fetched by the server without an allowlist |
| XSS | Unescaped user content in HTML, `innerHTML`, `dangerouslySetInnerHTML`, unsafe markdown rendering |
| Deserialization | Unsafe loaders (`pickle`, `yaml.load`, Java serialization, `eval`) on untrusted data |
| Crypto | Weak hashes for passwords (MD5, SHA1, unsalted), custom crypto, predictable randomness for tokens |
| Data exposure | Over-returning fields in APIs, verbose errors, stack traces to clients |
| Dependencies | New dependencies: maintained, widely used, pinned; known-vulnerable versions if a scanner is available |
| Config | Debug mode, permissive CORS, disabled TLS verification, default credentials |

## Findings

Each finding needs `file:line`, the vulnerable data flow (source → sink), an exploit scenario, severity, and a fix. No evidence, no finding.

| Severity | Meaning |
|---|---|
| critical | Exploitable remotely without auth, or leaks credentials or bulk data |
| high | Exploitable with some precondition, or breaks authorization |
| medium | Defense-in-depth gap with a plausible path to exploit |
| low | Hardening suggestion |

Mark each finding `caused` (introduced by the diff) or `pre-existing`.

## Output

```
Audited: <scope>
Trust boundaries: <entry points> → <sinks>

[high][caused] path/file.ext:42 — <vulnerability>
  Flow: <source> → <sink>
  Exploit: <concrete scenario>
  Fix: <recommendation>

Summary: <n critical, n high, ...>. <Safe to merge | Fix before merge>
```
