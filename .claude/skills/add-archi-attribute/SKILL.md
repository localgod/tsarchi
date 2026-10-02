---
name: add-archi-attribute
description: Checklist for making tsarchi load and save a new XML attribute, child element or type from .archimate files (on views, diagram children, view connections, elements, folders or the model root). Use when an issue says something is dropped on save, when roundtrip-diff shows a `missing` line, or when adding support for a new Archi type.
---

# Preserve a new Archi attribute or element

Every construct goes through the same pipeline:
XML → fast-xml-parser → `src/interfaces/schema/*` → `Parser` → `src/interfaces/*` (domain) → `Serializer` → schema → XML.
If one layer is missed, the value is silently dropped.

## 0. Know the format

Run the `verify-archi-format` skill first. You need to know whether it's an attribute, a child element or a `<feature>`, whether it repeats, and its default. Features need no code: they already round-trip through `features`.

## 1. Measure

`npm run roundtrip:diff -- <fixture>` (the `archi-roundtrip-diff` skill). Note the lines you intend to remove.

## 2. Find where it lives

| Owner in XML | Schema type | Domain type | Read / write |
| --- | --- | --- | --- |
| `<child>` in a view | `schema/Child.mts` | `Child.mts` | `childAttributes` / `childTextElements` in `internal/DiagramAttributeMapper.mts` |
| `<sourceConnection>` | `schema/SourceConnection.mts` | `SourceConnection.mts` | `connectionAttributes`; nested elements in `internal/SourceConnectionMapper.mts` |
| `<element>` that is a view | `schema/Element.mts` | `Element.mts` (+ `View.mts` if exposed via `ViewManager`) | `Parser.createElement` / `Serializer` view block |
| `<element>` (ArchiMate element or relationship) | `schema/Element.mts` | `Element.mts` | `Parser` / `Serializer` element handling |
| `<folder>` | `schema/Folder.mts` | `Folder.mts` / `ModelFolder` in `Model.mts` | `Parser` / `Serializer` folder handling |
| `<archimate:model>` | `schema/Model.mts` (`ModelAttributes`) | `Archimate` metadata | `Archimate.parse` / `serialize` |

## 3. Change each layer

- **Schema interface**: add `'@_name'?: string` for an attribute (fast-xml-parser values are strings), `name?: string` for a text element, `name?: T | T[]` for a repeatable element (new element shapes go in their own `schema/<Name>.mts`).
- **Domain interface**: use the natural TS type (`number`, `boolean`, `Map<string,string>`, arrays). Keep names matching Archi's, except where the XML name clashes with an existing field (e.g. connection `type` → `lineStyle`). Document such renames with a `/** */` comment.
- **Read/write**:
  - For diagram children and connections, add one row to the attribute table: `['property', 'xmlAttribute', 'string' | 'number' | 'boolean']`. That covers parse and serialize.
  - Elsewhere, read only when present (`!== undefined`) and write only when set, mirroring the existing code next to it.
  - Repeatable elements: normalize with `Array.isArray(x) ? x : [x]` when reading, and write an array.
  - Types: `typeFromXsiType()` / `toXsiType()`. If it is a new namespace, extend both and add its `xmlns:` in `Archimate.withRequiredNamespaces`.
  - New element or view types also go into the right list in `src/constants/archimate-mappings.mts`, or validation reports `unknown-type`.
- **Order**: the comparison is positional for repeated siblings. Keep the element order Archi writes (check a real file).

## 4. Test

- Add the construct to a fixture in `tests/fixtures/roundtrip/`: extend an existing one if it fits the theme, otherwise add `<topic>.archimate` (`git add -f`; it must pass `validateModel()`). `RoundtripFixtures.test.mts` picks it up automatically.
- If it came from an Archi file, add an assertion in `tests/ArchiFixtures.test.mts` that reads the value through the public API.
- If the API is public (e.g. `getView()` should expose it), add a unit test for that path too. Remember that `ViewManager.createView` / `elementToView` copy fields explicitly.
- `npm test`, `npm run lint`, `npm run format`, then `npm run roundtrip:diff` again.

## 5. Document

- Add a CHANGELOG `## [Unreleased]` entry under Added/Fixed, naming the attributes.
- Update the README if a public field or method changed.
- Put the before/after table from `archi-roundtrip-diff` in the PR.
