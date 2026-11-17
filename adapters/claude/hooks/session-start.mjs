// Claude Code SessionStart hook: warns when jarvis-kit is only partially installed.
// Silent when everything is in place, so a healthy setup costs no context.
import { collectFacts, diagnose, formatReport } from "../doctor.mjs";

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const { cwd = process.cwd() } = JSON.parse(raw || "{}");

  const problems = diagnose(collectFacts({ cwd }));
  if (!problems.length) return;

  process.stdout.write(
    JSON.stringify({
      systemMessage: `jarvis-kit: setup incomplete (${problems.map((p) => p.id).join(", ")}). Claude will explain how to fix it.`,
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: formatReport(problems) },
    }),
  );
}

main().catch((error) => {
  process.stderr.write(`jarvis session-start hook error (non-blocking): ${error.message}\n`);
  process.exit(1);
});
