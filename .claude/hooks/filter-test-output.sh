#!/usr/bin/env bash
# PreToolUse hook (Bash): when a command runs tests, keep only the last 100
# lines of output so long test logs don't flood the conversation.
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
[ -z "$cmd" ] && exit 0

# If running tests, keep only the last 100 lines
if printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])(npm (run )?test|npx vitest|vitest|jest|pytest|npm run e2e|node scripts/e2e-smoke\.cjs)([[:space:]]|$)'; then
  # Leave commands that already trim or redirect their output alone
  if printf '%s' "$cmd" | grep -qE '\| *(tail|head|grep)'; then exit 0; fi
  filtered_cmd="$cmd 2>&1 | tail -n 100"
  printf '%s' "$input" | jq --arg c "$filtered_cmd" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      updatedInput: (.tool_input + {command: $c})
    }
  }'
fi
exit 0
