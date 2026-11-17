import { test } from "node:test";
import assert from "node:assert/strict";
import { findSecrets } from "./secrets.mjs";

const diffWith = (line, file = "src/config.js") =>
  `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -0,0 +7,2 @@\n+const ok = 1;\n${line}\n`;

test("finds a GitHub token in an added line with file and line number", () => {
  const findings = findSecrets(diffWith(`+const t = "ghp_${"a".repeat(36)}";`));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, "github-token");
  assert.equal(findings[0].file, "src/config.js");
  assert.equal(findings[0].line, 8);
});

test("masks the secret in the excerpt", () => {
  const secret = `ghp_${"a".repeat(36)}`;
  const [finding] = findSecrets(diffWith(`+const t = "${secret}";`));
  assert.ok(!finding.excerpt.includes(secret));
});

test("finds AWS keys, private keys, and Anthropic keys", () => {
  assert.equal(findSecrets(diffWith("+key = AKIAABCDEFGHIJKLMNOP"))[0].rule, "aws-access-key");
  assert.equal(findSecrets(diffWith("+-----BEGIN RSA PRIVATE KEY-----"))[0].rule, "private-key");
  assert.equal(findSecrets(diffWith(`+k = "sk-ant-${"b".repeat(30)}"`))[0].rule, "anthropic-key");
});

test("ignores removed lines", () => {
  assert.deepEqual(findSecrets(diffWith(`-const t = "ghp_${"a".repeat(36)}";`)), []);
});

test("ignores lines marked with jarvis:allow-secret", () => {
  const line = `+const fake = "ghp_${"a".repeat(36)}"; // jarvis:allow-secret`;
  assert.deepEqual(findSecrets(diffWith(line)), []);
});

test("returns nothing for a clean diff", () => {
  assert.deepEqual(findSecrets(diffWith("+const name = 'jarvis';")), []);
});
