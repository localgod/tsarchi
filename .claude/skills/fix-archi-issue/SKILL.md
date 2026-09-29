---
name: fix-archi-issue
description: End-to-end workflow for fixing a tsarchi GitHub issue about Archi compatibility — a parse crash, data lost on save, false validation errors, or an unsupported Archi type. Use when asked to fix/implement an issue number, or when a bug report includes an .archimate file.
---

# Fix an Archi-compatibility issue

## 1. Understand

- `gh issue view <n> --comments`. Note linked issues: these bugs cluster (#375–#387), and one file often hits several.
- Check what is already tracked: `gh issue list --state open`. Anything you find that is out of scope becomes a new issue, not an extra change in this PR.
- Branch from `main`: `fix/<short-topic>` or `feat/<short-topic>`.

## 2. Reproduce with a real file

- Prefer an unmodified Archi-produced file. Look in `tests/fixtures/archi/` first, then Archi's testdata (see `verify-archi-format` for paths). Vendor new ones into `tests/fixtures/archi/`, add a line with the source path to its `README.md`, and `git add -f` the file.
- Run `npm run roundtrip:diff -- <file>` (`archi-roundtrip-diff` skill) to see crashes, losses and validation codes. Record the "before" numbers.
- Write the failing test first:
  - Crash or wrong value from an Archi file → `tests/ArchiFixtures.test.mts` (use its `parseFixture` helper).
  - Loss on save → a construct in `tests/fixtures/roundtrip/` (it must validate).
  - API behaviour → the matching `tests/*.test.mts`.
- Confirm the test fails for the reason in the issue.

## 3. Fix

- For format questions, use `verify-archi-format`. Quote the ecore/Java source instead of guessing.
- For attributes, elements and types, use `add-archi-attribute`.
- For crashes in mappers, the usual cause is fast-xml-parser's single-object-vs-array or a missing optional attribute (`xsi:type`). Fix the type (`T | T[]`, `?`) as well as the code, so the compiler finds the other call sites.
- Keep `Model`'s public shape stable if you can. If a public type must change, put it under a `⚠️ Type change` heading in the PR and under **Changed** in the CHANGELOG.

## 4. Verify

```bash
npm test && npm run lint && npm run format
npm run roundtrip:diff
```

- Every `tests/fixtures/roundtrip/` file stays `identical`.
- The target lines are gone from the Archi fixtures, and nothing new has appeared.
- For every remaining difference or validation code, an issue exists or you filed one.

## 5. Ship

- Add a CHANGELOG `## [Unreleased]` entry with an issue link: `([#<n>](https://github.com/localgod/tsarchi/issues/<n>))`.
- Commit as `fix: …` / `feat: …` with `Fixes #<n>` in the body.
- PR body:

  ```markdown
  Fixes #<n>

  ## Problem
  <what failed, with the exact error or lost data>

  ## Changes
  <bullets; name the source used to verify the format>

  ## Round-trip results
  | Fixture | Before | After | Remaining |

  ## Tests
  <new tests / fixtures; which fail without the fix>

  ## Out of scope
  <remaining problems → issue numbers>
  ```

- Ask before pushing or opening the PR, unless the user already said to.
