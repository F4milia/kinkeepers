#!/usr/bin/env bash
# Blocks edits to paths that need Ivan physically present, mechanically -
# CLAUDE.md's own scope-discipline rule ("touch only files within this
# session's scope... migrations, auth, RLS, Zoom settings... STOP and
# report") enforced by the harness instead of relying on Claude to
# remember it every time. See .claude/claude-code-hooks-setup.md.
#
# Enabled 2026-09-02, at Ferenz's explicit direction after confirming the
# consequence: every session touching a migration, lib/auth/**,
# lib/zoom/**, or a consent path must now launch with IVAN_GATE=1, or the
# edit is refused. This is a real, immediate workflow change - both
# streams need to adopt the env var, not just this one.
set -u
input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')
[ -z "$file" ] && exit 0

# KinKeepers-specific gated set: schema migrations (real, repeated
# collision/drift pain this project has already hit more than once - see
# CLAUDE.md's Learned Constraints), auth core, Zoom Server-to-Server OAuth
# / the five enforced HIPAA meeting settings, and consent/legal surfaces.
GATED='(supabase/migrations/|lib/auth/|lib/zoom/|.*consent.*)'

if echo "$file" | grep -Eiq "$GATED"; then
  if [ "${IVAN_GATE:-0}" != "1" ]; then
    echo "BLOCKED: $file is an Ivan-gated path (migrations/auth/zoom/consent). Stop and report this to the operator; do not work around it. Gated sessions are launched with IVAN_GATE=1 claude." >&2
    exit 2
  fi
fi
exit 0
