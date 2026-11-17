import { test } from "node:test";
import assert from "node:assert/strict";
import { isProtectedEnvPath, commandReadsEnvFile } from "./env-guard.mjs";

test("protects real env files", () => {
  for (const p of [".env", "/app/.env", "C:\\app\\.env.local", "config/.env.production"]) {
    assert.equal(isProtectedEnvPath(p), true, p);
  }
});

test("allows env templates and unrelated files", () => {
  for (const p of [".env.example", "a/.env.sample", ".env.template", ".env.dist", "env.js", ".envrc", "", undefined]) {
    assert.equal(isProtectedEnvPath(p), false, String(p));
  }
});

test("detects shell commands that read env files", () => {
  for (const cmd of ["cat .env", "grep API_KEY .env.local", "source ./.env", "export $(cat .env | xargs)", "Get-Content .env", "node app.js < .env"]) {
    assert.equal(commandReadsEnvFile(cmd), true, cmd);
  }
});

test("ignores env mentions inside commit messages and heredoc bodies", () => {
  const heredoc = "git commit -q -F - <<'EOF'\nfeat: add .env read guard\n\nWires Read, Grep and Bash. Try cat .env < .env\nEOF";
  assert.equal(commandReadsEnvFile(heredoc), false);
  assert.equal(commandReadsEnvFile('git commit -m "docs: explain why grep on .env is blocked"'), false);
});

test("allows commands that do not read env files", () => {
  for (const cmd of ["cp .env.example .env", "cat .env.example", "docker compose --env-file .env up", "ls -la", "cat README.md"]) {
    assert.equal(commandReadsEnvFile(cmd), false, cmd);
  }
});
