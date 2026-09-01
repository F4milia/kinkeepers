#!/usr/bin/env bash
# Runs after every Edit/Write/MultiEdit. Exit code 2 sends stderr back to
# Claude, which fixes the problem before moving on - catches type errors
# and lint failures in the same turn instead of at PR/CI time.
# See .claude/claude-code-hooks-setup.md for the source of this setup.
set -u
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
[ -z "$file" ] && exit 0
case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Lint just the changed file (fast).
if ! npx eslint "$file" 2>/tmp/hook-eslint.txt; then
  echo "ESLint failed on $file:" >&2
  cat /tmp/hook-eslint.txt >&2
  exit 2
fi

# Typecheck the project (tsc has no single-file mode with project refs).
if ! npx tsc --noEmit -p tsconfig.json 2>/tmp/hook-tsc.txt; then
  echo "Typecheck failed after editing $file:" >&2
  head -40 /tmp/hook-tsc.txt >&2
  exit 2
fi
exit 0
