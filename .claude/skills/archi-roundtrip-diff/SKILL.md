---
name: archi-roundtrip-diff
description: Measure what tsarchi loses when loading and saving an .archimate file, grouped by attribute/element, including files that fail validation. Use before and after any change to Parser, Serializer, mappers or schema interfaces, when triaging an issue about data being dropped on save, and to fill the before/after table in a PR.
---

# Round-trip diff

`tests/roundtrip-diff.mts` loads each file, calls `Archimate.serialize()` directly (no `assertValidModel`), and compares input and output with the same `compareObjects` used by the round-trip tests. Differences are grouped by kind and by the last two path segments, so one lost attribute across 60 elements shows as one line.

## Run

```bash
npm run roundtrip:diff                                     # all of tests/fixtures/archi and tests/fixtures/roundtrip
npm run roundtrip:diff -- tests/fixtures/archi/Archisurance.archimate
npm run roundtrip:diff -- --verbose path/to/file.archimate  # also print every raw difference with its full path
npm run build --silent && node dist/tests/roundtrip-diff.mjs --json tests/fixtures/archi  # machine-readable
```

The script builds first, so it always reflects the current `src`.

## Reading the output

```
tests/fixtures/archi/Archisurance.archimate: 164 differences
     66  missing   child.type          <- attribute `type` on <child> never written back
     49  key count element.child       <- follow-on noise: the same child now has fewer keys
     12  missing   child.model
  validation: missing-name ×144
```

- `missing <parent>.<key>`: the input had it, the output doesn't. This is the main signal.
- `value <parent>.<key>`: written back, but different (formatting, default values, number vs string).
- `length` / `array`: a repeated element lost or gained entries, or was collapsed to/from a single object.
- `key count`: a node has a different number of keys. Usually a consequence of a `missing` line on the same node, but if it appears alone the output has an **extra** key that the input didn't have. Rerun with `--verbose` to find it.
- `validation:` lists `validateModel()` issue codes. These don't affect the diff but explain why `saveModel()` would refuse the file.

Comparison is positional: if serialization reorders sibling elements, you'll get many `value`/`missing` lines under one parent. Check the order before chasing individual attributes.

## Workflow

1. Before changing code, run the diff on the fixtures relevant to the issue and save the summary lines.
2. Make the change.
3. Run it again. The target lines should disappear, and no new lines or files should appear. Every file in `tests/fixtures/roundtrip/` must stay `identical`.
4. Put the before/after/remaining numbers in the PR as a table:

   | Fixture | Before | After | Remaining |
   | --- | --- | --- | --- |
   | `Archisurance.archimate` | 304 | 164 | `child.type`, `child.model` (#386) |

5. For any remaining lines that aren't in scope, check that an issue exists (`gh issue list --search "<attribute>"`) and file one if not.
