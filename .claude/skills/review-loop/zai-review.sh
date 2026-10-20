#!/usr/bin/env bash
set -euo pipefail

step="${1:-}"
case "$step" in
  review) heading='# Review' ;;
  re-review) heading='# Re-Review' ;;
  *) echo "Aufruf: zai-review.sh review|re-review" >&2; exit 2 ;;
esac

root="$(git rev-parse --show-toplevel)"
cd "$root"
out=".review/$step.md"
log=".review/zai-$step.log"

set -a
. backend/.env
set +a

prompt="$(cat .claude/skills/review-loop/reviewer.md)

Schritt: $step"

ANTHROPIC_API_KEY="$TEST_ANTHROPIC_API_KEY" \
ANTHROPIC_BASE_URL="$EVAL_JUDGE_BASE_URL" \
ANTHROPIC_AUTH_TOKEN= \
claude -p "$prompt" \
  --bare \
  --model "${ZAI_REVIEW_MODEL:-glm-5.3}" \
  --effort max \
  --no-session-persistence \
  --max-turns 80 \
  --allowedTools Read Grep Glob "Bash(git diff:*)" "Bash(git status:*)" "Bash(pnpm --dir backend test:*)" \
  --disallowedTools Write Edit NotebookEdit WebFetch WebSearch \
  > "$out.tmp" 2> "$log"

answer="$(sed -n "/^$heading\$/,\$p" "$out.tmp" | sed "\${/^\`\`\`\$/d}")"
if [ -z "$answer" ]; then
  echo "Keine gültige Antwort von z.ai, siehe $out.tmp und $log" >&2
  exit 1
fi
printf '%s\n' "$answer" > "$out"
rm "$out.tmp"
cat "$out"
