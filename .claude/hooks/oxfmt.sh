#!/usr/bin/env bash
# PostToolUse hook: formats the docs that `npm run format` checks after Claude edits one.
# Keep the list in sync with the "format" script in package.json.
set -euo pipefail

file=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -n "$file" ] && [ -f "$file" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
case "$(realpath "$file")" in
  "$PWD"/README.md|"$PWD"/LICENSE.md|"$PWD"/CHANGELOG.md|"$PWD"/CONTRIBUTING.md) ;;
  *) exit 0 ;;
esac

if ! output=$(npx --no-install oxfmt "$file" 2>&1); then
  echo "oxfmt could not format $file:" >&2
  echo "$output" >&2
  exit 2
fi
