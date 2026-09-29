---
name: verify-archi-format
description: Look up how Archi actually writes a type, attribute or element in .archimate XML (attribute vs child element vs <feature>, namespace, default value, numeric codes) from Archi's own source instead of guessing. Use before mapping any new XML construct in tsarchi, or when a PR would otherwise say "based on my reading of Archi's format".
---

# Verify the Archi file format

Archi serializes its EMF model with XMI. The ecore files are the source of truth for what goes where. Check them, and a real file, before adding anything to the schema or mapper tables.

## Sources (github.com/archimatetool/archi, branch `master`)

| What | Path |
| --- | --- |
| Core model (elements, views, diagram objects, connections, folders) | `com.archimatetool.model/model/archimate.ecore` |
| Canvas model (`canvas:` namespace) | `com.archimatetool.canvas/model/canvas.ecore` |
| Feature names and constants (`FEATURE_*`, line style / text position codes) | `com.archimatetool.model/src/com/archimatetool/model/IDiagramModelObject.java`, `IDiagramModelConnection.java`, `ITextPosition.java`, `ITextAlignment.java`, `IFontAttribute.java` |
| Legacy-format upgrades | `com.archimatetool.editor/src/com/archimatetool/editor/model/compatibility/` |
| Real files | `tests/**/testdata/**/*.archimate` (see `tests/fixtures/archi/README.md` for the ones already vendored) |

Fetch without cloning:

```bash
gh api repos/archimatetool/archi/contents/com.archimatetool.model/model/archimate.ecore \
  -H "Accept: application/vnd.github.raw" > "$SCRATCH/archimate.ecore"
gh search code --repo archimatetool/archi '"iconColor"'          # find where a name is defined
gh api 'repos/archimatetool/archi/git/trees/master?recursive=1' --jq '.tree[].path' | grep testdata
```

(`$SCRATCH` = your scratchpad directory.)

## Reading an ecore entry

- An `EAttribute` is written as an **XML attribute**, unless it has
  `<eAnnotations source="http:///org/eclipse/emf/ecore/util/ExtendedMetaData"><details key="kind" value="element"/>`,
  in which case it is a **child element** with text content (e.g. `documentation`, `content`, `notes`, `hintContent`, `purpose`).
- A containment `EReference` is written as a child element (`child`, `sourceConnection`, `bounds`, `bendpoint`, `property`, `feature`). If it has `upperBound="-1"` it can repeat, so type it `T | T[]` in `src/interfaces/schema/`.
- A non-containment `EReference` is written as an attribute holding an id, or several space-separated ids (`targetConnections`, `archimateElement`, `model`).
- `defaultValueLiteral`: EMF does **not** write attributes equal to their default. Don't write them either, and don't treat their absence as an error.
- The `xsi:type` prefix follows the package: `archimate:` for archimate.ecore, `canvas:` for canvas.ecore.

## Features, not attributes

If a name isn't in any ecore but appears as a `FEATURE_*` constant in the Java interfaces, Archi stores it as
`<feature name="<name>" value="<value>"/>`. `IDiagramModelObject.java` currently defines `lineAlpha`, `gradient`, `iconVisible`, `iconColor`, `deriveElementLineColor` and `lineStyle`. These already round-trip through the `features` map. **Don't** add them to `childAttributes`: that would expose a property that is never populated from real files. (#390 did this for `lineAlpha`, `gradient` and `iconColor`; see #391.)

## Before you write code

Collect, and quote in the PR:

1. The ecore/Java location (path and line) that defines the construct.
2. Whether it is an attribute, an element or a feature, whether it repeats, and its default.
3. A real Archi file that contains it, if any. `grep -l '<name>' tests/fixtures/archi/*.archimate` first, then Archi's testdata. If no real file has it, say so, and build the round-trip fixture from the ecore definition.
