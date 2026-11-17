// Flags repository-local git config that makes ordinary git commands run arbitrary programs.
// Input: the output of `git config --local --list` (one key=value per line).

const DANGEROUS_KEYS = [
  /^core\.(sshcommand|pager|editor|askpass|gitproxy)$/,
  /^sequence\.editor$/,
  /^diff\.external$/,
  /^diff\..+\.(textconv|command)$/,
  /^merge\..+\.driver$/,
  /^filter\..+\.(clean|smudge|process)$/,
  /^gpg\.(.+\.)?program$/,
  /^credential\.(.+\.)?helper$/,
  /^pager\..+$/,
  /^include\.path$/,
  /^includeif\..+\.path$/,
];

const isSafe = (key, value) => {
  if (key === "core.fsmonitor") return /^(true|false|)$/i.test(value);
  if (/^filter\..+\.(clean|smudge|process)$/.test(key)) return /^git-lfs\b/.test(value);
  return false;
};

export function findDangerousGitConfig(listOutput) {
  const findings = [];
  for (const line of String(listOutput ?? "").split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).toLowerCase();
    const value = line.slice(eq + 1);
    const risky = key === "core.fsmonitor" || DANGEROUS_KEYS.some((pattern) => pattern.test(key));
    if (risky && !isSafe(key, value)) findings.push({ key, value });
  }
  return findings;
}
