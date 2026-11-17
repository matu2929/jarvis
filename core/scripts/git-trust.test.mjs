import { test } from "node:test";
import assert from "node:assert/strict";
import { findDangerousGitConfig } from "./git-trust.mjs";

const keys = (output) => findDangerousGitConfig(output).map((f) => f.key);

test("accepts a normal local config", () => {
  const output = [
    "core.repositoryformatversion=0",
    "core.filemode=false",
    "core.bare=false",
    "core.fsmonitor=false",
    "remote.origin.url=https://github.com/user/repo.git",
    "branch.main.remote=origin",
  ].join("\n");
  assert.deepEqual(keys(output), []);
});

test("flags config keys that execute programs", () => {
  const output = [
    "core.fsmonitor=./payload.sh",
    "core.sshcommand=ssh -o ProxyCommand=evil",
    "core.pager=evil",
    "diff.external=evil",
    "filter.x.smudge=evil",
    "gpg.program=evil",
    "include.path=../evil.config",
  ].join("\n");
  assert.deepEqual(keys(output), [
    "core.fsmonitor",
    "core.sshcommand",
    "core.pager",
    "diff.external",
    "filter.x.smudge",
    "gpg.program",
    "include.path",
  ]);
});

test("allows git-lfs filters", () => {
  const output = "filter.lfs.clean=git-lfs clean -- %f\nfilter.lfs.process=git-lfs filter-process";
  assert.deepEqual(keys(output), []);
});
