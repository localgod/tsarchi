#!/usr/bin/env bash
# PostToolUse hook: formats a file that `npm run format` checks after Claude edits it.
# Keep the list in sync with the "format" script in package.json.
set -euo pipefail

file=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -n "$file" ] && [ -f "$file" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
case "$(realpath "$file")" in
  "$PWD"/README.md|"$PWD"/LICENSE.md|"$PWD"/CHANGELOG.md|"$PWD"/CONTRIBUTING.md) ;;
  "$PWD"/src/*|"$PWD"/tests/*|"$PWD"/scripts/*) ;;
  *) exit 0 ;;
esac

# Generated files are skipped through ignorePatterns in .oxfmtrc.json.
if ! output=$(npx --no-install oxfmt --no-error-on-unmatched-pattern "$file" 2>&1); then
  echo "oxfmt could not format $file:" >&2
  echo "$output" >&2
  exit 2
fi
