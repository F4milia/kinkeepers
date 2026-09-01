#!/usr/bin/env bash
# No destructive shell commands, mechanically. See
# .claude/claude-code-hooks-setup.md.
#
# The db push/reset --linked line is deliberate and unconditional at
# Ferenz's direction (2026-09-02): R1 (the real deploy pipeline) doesn't
# exist yet, so this is currently the ONLY way migrations reach the
# hosted project - blocking it here means a genuinely needed hosted push
# goes through Ferenz/Ivan directly rather than an ad-hoc session command,
# not that it becomes silently impossible.
set -u
input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // empty')
[ -z "$cmd" ] && exit 0

deny() { echo "BLOCKED: $1" >&2; exit 2; }

echo "$cmd" | grep -Eq 'git push.*(--force|-f)( |$)'        && deny "force push"
echo "$cmd" | grep -Eq 'git push.*[ :]main( |$)'              && deny "direct push to main - open a PR"
echo "$cmd" | grep -Eq 'supabase db (reset|push).*--linked'  && deny "db reset/push against a linked (remote) project"
echo "$cmd" | grep -Eq 'rm -rf (/|~|\.\.|\$HOME)'             && deny "rm -rf on a root/home path"
echo "$cmd" | grep -Eq 'git checkout .* -- \.$|git reset --hard' && deny "discarding working tree"
exit 0
