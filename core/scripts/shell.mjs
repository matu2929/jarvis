// Helpers to inspect shell commands an agent is about to run.

const GIT = /(^|[\s;&|(`])git(?=\s|$)/;
const GIT_COMMIT = /(^|[\s;&|(`])git(?:\s+(?:-[Cc]\s+\S+|--?[\w-]+(?:=\S+)?))*\s+commit(?=\s|$|[;&|)])/;
const HEREDOC = /<<-?\s*(['"]?)(\w+)\1[^\n]*\n([\s\S]*?)\n[ \t]*\2(?=\s|$|\))/;
const MESSAGE_ARG = /(?:^|\s)(?:-[a-zA-Z]*m|--message)(?:\s+|=)(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([^\s;&|]+))/g;

export const invokesGit = (command) => GIT.test(String(command ?? ""));

export const isGitCommit = (command) => GIT_COMMIT.test(String(command ?? ""));

export function commitStagesAll(command) {
  const cmd = String(command ?? "");
  const match = GIT_COMMIT.exec(cmd);
  if (!match) return false;
  const args = cmd.slice(match.index + match[0].length).split(/[;&|]/)[0];
  return /(^|\s)(--all|-[a-zA-Z]*a[a-zA-Z]*)(?=\s|$)/.test(args.replace(/"[^"]*"|'[^']*'/g, ""));
}

// A heredoc feeds the commit only when its `<<` sits in the commit command itself:
// on the same line and not after a separator that starts another command.
const feedsCommit = (beforeHeredoc) =>
  !/[\n;&|]/.test(beforeHeredoc.replace(/"[^"]*"|'[^']*'/g, "").replace(/["'].*$/, ""));

// Returns the commit message, or null when it cannot be determined statically
// (editor, -F file, or variables / command substitution other than a heredoc).
export function extractCommitMessage(command) {
  const commit = GIT_COMMIT.exec(String(command ?? ""));
  if (!commit) return null;
  const cmd = String(command).slice(commit.index + commit[1].length);

  const heredoc = HEREDOC.exec(cmd);
  if (heredoc && feedsCommit(cmd.slice(0, heredoc.index))) return heredoc[3].trim();

  const parts = [];
  for (const match of cmd.matchAll(MESSAGE_ARG)) {
    const [, doubleQuoted, singleQuoted, bare] = match;
    if (doubleQuoted !== undefined) {
      if (/\$|`/.test(doubleQuoted)) return null;
      parts.push(doubleQuoted.replace(/\\(["\\$`])/g, "$1"));
    } else if (singleQuoted !== undefined) {
      parts.push(singleQuoted);
    } else {
      if (/\$|`/.test(bare)) return null;
      parts.push(bare);
    }
  }
  return parts.length ? parts.join("\n\n") : null;
}
