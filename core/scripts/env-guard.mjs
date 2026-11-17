// Detects reads of real .env files. Templates (.env.example, .sample, .template, .dist) stay readable.
// Best-effort for shell commands: it catches common readers, not every possible program.

const TEMPLATE_SUFFIXES = new Set(["example", "sample", "template", "dist"]);
// Readers count only in command position (start, or after ; & | ( ` $( ), not inside prose.
const READERS =
  /(^|[;&|(`\n]|\$\()\s*(?:sudo\s+)?(cat|type|less|more|head|tail|grep|egrep|fgrep|rg|sed|awk|nl|od|xxd|base64|strings|bat|source|get-content|gc|select-string|sls)(?=[\s;&|)]|$)/i;
const DOT_SOURCE = /(^|[;&|]\s*)\.\s+\S/;
const INPUT_REDIRECT = /(?<!<)<\s*["']?([^\s"'<>|;&]+)/g;
// Text that is data, not commands: heredoc bodies and commit message arguments.
const HEREDOC_BODY = /(<<-?\s*(['"]?)(\w+)\2[^\n]*)\n[\s\S]*?\n[ \t]*\3(?=\s|$|\))/g;
const MESSAGE_ARG = /((?:^|\s)(?:-[a-zA-Z]*m|--message)(?:\s+|=))(?:"(?:[^"\\]|\\.)*"|'[^']*')/g;

const stripData = (cmd) => cmd.replace(HEREDOC_BODY, "$1").replace(MESSAGE_ARG, "$1''");

const basename = (path) => String(path).split(/[\\/]/).pop();

export function isProtectedEnvPath(path) {
  if (!path) return false;
  const name = basename(path);
  if (name === ".env") return true;
  const match = /^\.env\.(.+)$/.exec(name);
  return Boolean(match) && !TEMPLATE_SUFFIXES.has(match[1].toLowerCase());
}

export function commandReadsEnvFile(command) {
  const cmd = stripData(String(command ?? ""));
  for (const match of cmd.matchAll(INPUT_REDIRECT)) {
    if (isProtectedEnvPath(match[1])) return true;
  }
  const mentionsEnvFile = cmd.split(/[\s;&|<>()'"`=]+/).some(isProtectedEnvPath);
  return mentionsEnvFile && (READERS.test(cmd) || DOT_SOURCE.test(cmd));
}
