#!/usr/bin/env bash
# PostToolUse hook: lints a JavaScript/TypeScript file after Claude edits it.
# Exit code 2 sends oxlint's findings back to Claude so it can fix them.
set -euo pipefail

file=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
case "$file" in
  *.mts|*.ts|*.mjs|*.js) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
case "$(realpath "$file")" in
  "$PWD"/*) ;;
  *) exit 0 ;;
esac

if ! output=$(npx --no-install oxlint --deny-warnings --ignore-path .gitignore "$file" 2>&1); then
  echo "oxlint found problems in $file:" >&2
  echo "$output" >&2
  exit 2
fi
