#!/usr/bin/env bash
# Claude doesn't end a turn with red tests, mechanically. See
# .claude/claude-code-hooks-setup.md.
#
# Deliberately `npm test` (vitest) only, not the pgTAP suite too: pgTAP
# needs the local Supabase stack running, which isn't guaranteed at Stop
# time, and a hook that fails because Postgres isn't up (rather than
# because the code is actually broken) would be worse than no hook.
set -u
input=$(cat)
active=$(echo "$input" | jq -r '.stop_hook_active // false')
[ "$active" = "true" ] && exit 0   # already looped once; let it stop and report

# Only run if there are uncommitted or unpushed changes (skip on pure Q&A turns).
if git diff --quiet && git diff --cached --quiet && [ -z "$(git log @{u}..HEAD 2>/dev/null)" ]; then
  exit 0
fi

if ! npm test --silent 2>/tmp/hook-test.txt; then
  echo "Tests failed. Fix before finishing:" >&2
  tail -60 /tmp/hook-test.txt >&2
  exit 2
fi
exit 0
