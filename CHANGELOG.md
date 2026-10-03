# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](http://semver.org/).

This project adheres to [Keep a CHANGELOG](http://keepachangelog.com/)

## [Unreleased]

### Added

- `upsertElement()` returns the inserted or updated element, as stored in the model, instead of `void` ([#460](https://github.com/localgod/tsarchi/issues/460)).

### Changed

- `updateElement()` removes a field whose key is set to `undefined` in the patch, as `updateFolder()` does, so an optional field such as `documentation`, `properties` or `features` can be removed and a name can be cleared (`name: undefined` makes it empty). Keys left out are still unchanged, and `id` and `type` are kept. A patch that set keys to `undefined` used to leave those fields unchanged ([#454](https://github.com/localgod/tsarchi/issues/454)).
- A model loaded without a `name` attribute has an empty name (`getName()` returns `''`) instead of `'Unnamed Model'`, so saving it no longer adds a name it did not have ([#456](https://github.com/localgod/tsarchi/issues/456)).

### Fixed

- `deleteElement()` removes the relationships it deletes along with an element from the nested folders that list them, and `deleteView()` (on `Archimate` or `ViewManager`) removes the view from its nested folder, so `getFolders()` no longer reports ids of deleted relationships and views. `deleteFolder()` is fixed along with them ([#459](https://github.com/localgod/tsarchi/issues/459)).
- `upsertElement()` no longer writes `Added element …` or `Updated element …` to the console ([#460](https://github.com/localgod/tsarchi/issues/460)).
- A model with an empty name is saved without a `name` attribute on `<archimate:model>` instead of with `name=""`, as Archi does ([#456](https://github.com/localgod/tsarchi/issues/456)).
- An element or relationship with an empty name is saved without a `name` attribute instead of with `name=""`, as Archi does (`Nameable.name` defaults to `""`, and EMF does not write default values). An element or relationship loaded without a `name` attribute now has `name: ''` instead of `undefined`, matching its `string` type ([#455](https://github.com/localgod/tsarchi/issues/455)).

## [2.1.0] - 2026-10-03

### Added

- `validateModel()` reports an element or relationship without an `xsi:type` with the new `missing-type` error code. Such elements used to be saved with an invented `xsi:type="archimate:Unknown"`, and are now saved without one ([#449](https://github.com/localgod/tsarchi/issues/449)).

### Changed

- `unknown-type` is a warning instead of an error, so a model with element or relationship types tsarchi does not know (from a newer Archi or a plugin) can be saved with `toXml()`, and those elements and relationships are written back unchanged. Namespace declarations on folders, elements, relationships, diagram children and view connections are kept on save, so a prefixed type such as `vendor:Widget` stays bound. `upsertElement()` and `upsertRelationship()` still throw for an unknown type ([#449](https://github.com/localgod/tsarchi/issues/449)).

### Fixed

- `<bounds>` keeps the attributes Archi omits. Archi does not write `x`/`y` when they are 0 or `width`/`height` when they are -1 (its defaults), and saving used to add `x="0" y="0"`. Missing attributes now load as those defaults, so a missing `width` or `height` loads as -1 instead of 0, and attributes equal to a default are no longer written ([#450](https://github.com/localgod/tsarchi/issues/450)).

## [2.0.0] - 2026-10-02

### Added

- `Archimate.getFolders(folderKey)` returns the nested folders of a top-level folder, and the new `Folder` interface describes them. Top-level folders in `Model` now share the `ModelFolder` interface, which adds optional `documentation`, `properties` and `folders`.
- Sketch (`SketchModel`) and canvas (`CanvasModel`) views are recognised as view types, so models containing them validate and can be saved ([#382](https://github.com/localgod/tsarchi/issues/382)). Canvas types are stored without their `canvas:` prefix (`CanvasModel`, `CanvasModelBlock`, ...) and get it back on save, and `xmlns:canvas` is declared when canvas views are added to a model that lacks it.
- Diagram children now keep the style and content Archi writes for ArchiMate, sketch and canvas views: `lineColor`, `lineWidth`, `font`, `fontColor`, `alpha`, `textPosition`, `borderType`, `borderColor`, `imagePath`, `imagePosition`, `locked`, `hintTitle`, `hintContent`, `content`, `notes`, properties and features.
- View connections now keep `name`, the line style (`type` attribute, exposed as `lineStyle`), font, line and text attributes, `locked`, documentation, bendpoints, properties and features.
- Views keep their `viewpoint`, `background` and `connectionRouterType` attributes.
- Load and save keep the remaining content Archi writes in its test models ([#386](https://github.com/localgod/tsarchi/issues/386)): the model `<purpose>` (new `getPurpose()` / `setPurpose()`), `accessType` on access relationships (`Element.accessType`, also accepted by `upsertRelationship`), the alternate figure of a diagram object (`type` attribute, exposed as `Child.figure`), and the view a `DiagramModelReference` points to (`Child.model`).
- View connections expose the label settings Archi stores as `<feature>` entries as typed properties: `SourceConnection.nameVisible` and `SourceConnection.textRelativePosition`. They are read from a connection's features, and saved back as features in place, with `SourceConnection.features` keeping every feature in file order ([#419](https://github.com/localgod/tsarchi/issues/419)).
- Model-level properties, metadata and specializations are kept on load and save ([#410](https://github.com/localgod/tsarchi/issues/410)). New `getProperties()` / `setProperties()`, `getMetadata()` / `setMetadata()` and `getProfiles()` / `getProfile()` / `setProfiles()` on `Archimate`, and a new `Profile` interface. Elements and relationships keep the profiles applied to them (`Element.profiles`), and `validateModel()` reports a reference to a profile that does not exist with the new `element-missing-profile` code. Other attributes and child elements of `<archimate:model>` that tsarchi does not map, such as model features, are written back unchanged.
- Folders (top-level and nested), elements, relationships and views keep their `<feature>` entries on load and save, as a new `features` map on `Element`, `Folder`, `ModelFolder` and `View` ([#422](https://github.com/localgod/tsarchi/issues/422)). Attributes and child elements that tsarchi does not map on these nodes, and on diagram children and view connections, are kept in a new `unrecognized` field and written back unchanged.
- `Archimate.getFolder(folderKey)` returns the id, name, documentation, properties and features of a top-level folder, as a new `ModelFolderDetails` type, and `Archimate.updateFolder(folderKey, patch)` changes them ([#425](https://github.com/localgod/tsarchi/issues/425)).
- `Archimate.getFolderById(folderId)` and `Archimate.updateFolderById(folderId, patch)` read and change the name, documentation, properties and features of any folder by id, nested at any depth or top-level, as a new `FolderDetails` type. They follow the semantics of `getFolder` / `updateFolder` ([#428](https://github.com/localgod/tsarchi/issues/428)).
- `Archimate.createFolder(parentFolderId, details)`, `moveFolder(folderId, parentFolderId)`, `deleteFolder(folderId)` and `moveElementToFolder(elementId, folderId)` create, move and delete nested folders and move elements, relationships and views between folders. Moves stay within one top-level folder, as in Archi, and deleting a folder deletes its content like `deleteElement` and `deleteView` do ([#429](https://github.com/localgod/tsarchi/issues/429)).
- `validateModel()` checks relationships that have another relationship as their source or target against Archi's relationships matrix, and reports a disallowed combination with the new `relationship-endpoint-not-allowed` code. `upsertRelationship()` throws for the same combinations. Only an association may connect an element and a relationship, except that a Grouping, Location or Plateau may also aggregate or compose a relationship. A relationship may not connect to another relationship, to a Junction, to itself or to one of its own endpoints ([#403](https://github.com/localgod/tsarchi/issues/403)).
- `validateModel()` checks every relationship type against Archi's relationships matrix, and `upsertRelationship()` throws for a type the matrix does not allow ([#432](https://github.com/localgod/tsarchi/issues/432)). This includes Archi's Junction rules: every relationship on a Junction has the same type, except aggregation or composition from a Grouping or Location, and the relationships on either side of a Junction must be allowed between the concepts it links. New validation codes are `relationship-type-not-allowed` and `junction-relationship-type-mismatch`. The matrix is generated from Archi's `relationships.xml` by `npm run generate:relationships` and is exported as `relationshipsMatrix`, with a new `allowedRelationshipTypes(sourceType, targetType)` helper.
- `ApplicationEvent`, `Equipment` and `Product` are recognised element types, so models that contain them validate and `upsertElement()` accepts them ([#437](https://github.com/localgod/tsarchi/issues/437)).
- `Archimate.getName()` / `setName()`, `getId()` and `getVersion()` expose the model's name, id and file format version, and `Archimate.listElements()` and `listRelationships()` list every element (without relationships and views) and every relationship in the model ([#380](https://github.com/localgod/tsarchi/issues/380)).
- `Archimate.fromXml(text)` loads a model from the text of an `.archimate` file and `archimate.toXml()` returns it as text, so models can be loaded and saved without a file path. `toXml()` validates the model first, as saving does. Loading failures throw the new `ArchimateParseError`, whose `kind` is `not-xml` (with `line` and `column`), `not-archimate` or `invalid-structure` (with the underlying error as `cause`). `TsArchi` uses the same code ([#379](https://github.com/localgod/tsarchi/issues/379)).

### Changed

- ⚠️ `TsArchi` moved from `tsarchi` to the new `tsarchi/node` entry point (`import { TsArchi } from "tsarchi/node"`), so the `tsarchi` entry point no longer imports `fs/promises` and can be bundled for the browser. The package is marked `"sideEffects": false` so bundlers can tree-shake it ([#378](https://github.com/localgod/tsarchi/issues/378)).
- `chalk` moved from `dependencies` to `devDependencies`, as only the round-trip scripts in `tests/` use it, so installing `tsarchi` no longer installs `chalk`. A test checks that the runtime dependencies are exactly the packages `src/` imports ([#446](https://github.com/localgod/tsarchi/issues/446)).
- ⚠️ `TsArchi.load()` and `loadModel()` throw instead of logging the error and returning `{}` or an empty model: an `ArchimateParseError` for text that is not an Archi model, and the read error for a file that cannot be read. `load()` now returns `Promise<Schema>`. XML that is not well-formed is now rejected; before, the check never failed. `loadModel()` replaces the model that `getModel()` returns with a new `Archimate` instead of loading into the existing one ([#379](https://github.com/localgod/tsarchi/issues/379)).
- ⚠️ Internal helpers are no longer part of the public API ([#395](https://github.com/localgod/tsarchi/issues/395)). `Parser`, `Serializer`, `BoundsMapper`, `SourceConnectionMapper` and `DiagramAttributeMapper` (with its attribute tables) moved to `src/internal/`, which the generated index skips. Use `Archimate` and `TsArchi` to load and save models. The unused `sketchModelChildTypes` / `SketchModelChildType` exports are removed.
- ⚠️ The relationship type lists follow Archi's `archimate.ecore` ([#439](https://github.com/localgod/tsarchi/issues/439)). `UsedByRelationship` (ArchiMate 2, which Archi converts to `ServingRelationship` on load), `RepresentationRelationship` and `MaterialRelationship`, which Archi never writes, are removed from `archimateRelationshipTypes` and `ArchimateRelationshipType`, so a model that contains them reports `unknown-type`. The short names in `archimateRelationshipAliasTypes` (`Flow`, `Serving`, ...) are no longer model types: they are removed from `archimateModelTypes`, `ArchimateModelType`, `elementTypeToFolderKey` and `Relationship['type']`. `upsertRelationship()` and `findRelationshipsBetween()` still accept them, and `upsertRelationship()` stores the full type, so models no longer save with an `xsi:type` Archi cannot load. `UsedBy` is no longer a short name, and `Access` and `Assignment` are new ones. The new `resolveRelationshipType()` turns a short name into the full type.
- ⚠️ The element type lists follow Archi's `archimate.ecore` ([#437](https://github.com/localgod/tsarchi/issues/437)). `Stage`, `Actor`, `BusinessProduct` and `TechnologyObject`, which Archi never writes, are removed from the exported lists and from `ArchimateElementType`. `Material` is removed from `archimateRelationshipAliasTypes` and `ArchimateRelationshipAliasType`: it clashed with the `Material` element, and `upsertElement()` put Material elements in the Relations folder.
- ⚠️ `ValidationIssue` has a new required `severity` field (`'error' | 'warning'`, type `ValidationSeverity`). `assertValidModel()`, and so saving, now fails only on errors, and `ArchimateValidationError.issues` holds only the errors. `missing-name`, `relationship-endpoint-not-allowed`, `relationship-type-not-allowed` and `junction-relationship-type-mismatch` are warnings, because Archi opens and saves such models ([#398](https://github.com/localgod/tsarchi/issues/398)).
- ⚠️ `Junction` moved from `archimateRelationshipTypes` / `ArchimateRelationshipType` to the new `archimateConnectorTypes` / `ArchimateConnectorType`, which is part of `ArchimateElementType`. New junctions are placed in the `other` folder, as Archi does, and `upsertRelationship` no longer accepts `Junction` as a relationship type ([#397](https://github.com/localgod/tsarchi/issues/397)).
- ⚠️ `View.background` is now a `number`, matching `Element.background` and the integer Archi writes; `createView()` takes `background` as a number too ([#393](https://github.com/localgod/tsarchi/issues/393)).
- ⚠️ `'Diagram'` is no longer in `archimateViewTypes` / `ArchimateViewType`, as Archi never writes it, and `View['type']` is now `ArchimateViewType`. `getView()` returns `null` and `listViews()` skips elements in the Views folder whose type is not a view type, instead of returning them as views. The new `isArchimateViewType()` type guard checks a type ([#394](https://github.com/localgod/tsarchi/issues/394)).
- ⚠️ `upsertElement` matches on `id` when one is given, like `upsertRelationship`, instead of on `name` + `type`. Without an `id`, only named elements are matched by `name` + `type`, so unnamed elements such as junctions are always added instead of being merged into the first one. It throws when the given `id` is already used by something other than an element in the target folder ([#414](https://github.com/localgod/tsarchi/issues/414)).
- `View.type` now also allows `'SketchModel'` and `'CanvasModel'`, and `getView()` reports the actual view type.
- `Child.sourceConnection` is now typed `SourceConnection | SourceConnection[]`, matching the XML when a diagram child has several connections. Code that reads it as a single object must handle the array case.
- `SourceConnection.archimateRelationship` is now optional, since note and sketch connections have no underlying relationship.
- The schema `Model` interface now extends a new `ModelAttributes` interface, which accepts any `@_xmlns:*` namespace attribute.
- ⚠️ The schema `Model.folder` is now typed `Folder | Folder[]`, matching what fast-xml-parser returns for a model with one top-level folder. `serialize()` still writes an array, but code that reads `folder` from a parsed file must handle the single-object case ([#434](https://github.com/localgod/tsarchi/issues/434)).
- The npm package contains only the compiled library (`dist/src`). The compiled round-trip test scripts and examples are no longer published.

### Fixed

- Loading a model with a single top-level `<folder>` no longer throws `folder?.find is not a function` ([#434](https://github.com/localgod/tsarchi/issues/434)).
- Diagram children expose the style settings Archi stores as `<feature>` entries as typed properties: `lineAlpha`, `gradient`, `iconVisible`, `iconColor`, `deriveElementLineColor` and `lineStyle`. They are read from the features of files written by Archi, and saved as `<feature name="…" value="…"/>` in place of the previous XML attributes, which Archi ignores. Clearing one of these properties removes its feature, and `Child.features` keeps every feature in file order ([#391](https://github.com/localgod/tsarchi/issues/391)).
- `listViews()` returns sketch and canvas views too, matching `getView()`. Pass `{ type: 'ArchimateDiagramModel' }` to list only ArchiMate views, as before ([#416](https://github.com/localgod/tsarchi/issues/416)).
- `getView()` and `listViews()` return a view's `viewpoint`, `background` and `connectionRouterType` ([#393](https://github.com/localgod/tsarchi/issues/393)).
- `createView()` and `generateViewFromElements()` store the `viewpoint` and `background` they are given, so they are saved. Adding diagram objects, groups or connections to a view, or restyling them, no longer drops these attributes from the view ([#392](https://github.com/localgod/tsarchi/issues/392)).
- OR junctions stay OR junctions: the junction `type` attribute (`type="or"`) is kept on load and save, exposed as `Element.junctionType`. Junctions without it are AND junctions, Archi's default, and are still saved without the attribute ([#402](https://github.com/localgod/tsarchi/issues/402)).
- Deleting an element now removes its diagram objects at any nesting depth, including objects nested in other diagram objects, together with the objects nested in them, every connection from or to anything removed, and every `targetConnections` reference to those connections. Before, only objects at the top level or in a `Group` were removed, and `validateModel()` reported `diagram-object-missing-element` for the rest ([#407](https://github.com/localgod/tsarchi/issues/407)).
- Deleting a view now also removes the diagram model references to it in other views, at any nesting depth, together with the connections attached to them and every `targetConnections` reference to those connections, as Archi does. `validateModel()` reports a reference to a view that does not exist with the new `diagram-reference-missing-view` code ([#409](https://github.com/localgod/tsarchi/issues/409)).
- Relationships can use another relationship as their source or target, as ArchiMate 3 allows: `validateModel()` no longer reports `relationship-missing-source` / `relationship-missing-target` for them, and `upsertRelationship` accepts them. Views are no longer accepted as relationship endpoints. Deleting an element or relationship also removes relationships attached to the removed relationships ([#383](https://github.com/localgod/tsarchi/issues/383)).
- View connections drawn onto other connections are no longer lost: nested `sourceConnection`s and a connection's `targetConnections` are loaded and saved in place (`SourceConnection.sourceConnection`, `SourceConnection.targetConnections`). `validateModel()` checks connection endpoints against both diagram objects and connections, so it no longer reports `view-connection-missing-target` / `view-target-connection-missing-source` for them ([#384](https://github.com/localgod/tsarchi/issues/384)).
- Deleting a relationship now also removes its view connections in models loaded from a file, including connections nested in diagram objects or in other connections and connections drawn onto a removed connection. Every `targetConnections` reference to a removed connection is dropped, keeping the other ids in a space-separated list ([#405](https://github.com/localgod/tsarchi/issues/405)).
- Relationships can use a junction as their source or target: `upsertRelationship` no longer throws `Relationship target element ... not found` for junction endpoints ([#397](https://github.com/localgod/tsarchi/issues/397)).
- `Location` and `Grouping` are recognised element types in the `other` folder, so models using them no longer fail validation with `unknown-type`. They are exported as `archimateOtherElementTypes` / `ArchimateOtherElementType` and included in `ArchimateElementType` ([#381](https://github.com/localgod/tsarchi/issues/381)).
- Nested folders are no longer dropped. Their elements are loaded into the top-level folder's `elements` list, and the folders are saved back in place with their name, id, documentation and properties ([#376](https://github.com/localgod/tsarchi/issues/376)).
- Top-level folders keep their name and documentation on save instead of being reset to the default name.
- `validateModel()` no longer reports `missing-name` for relationships and junctions, which Archi saves without a name by default, so models with unnamed relationships can be saved ([#377](https://github.com/localgod/tsarchi/issues/377)).
- Parsing no longer throws on view connections without `xsi:type` (as written by Archi in sketch and canvas models). They default to `Connection` and are saved without the attribute ([#375](https://github.com/localgod/tsarchi/issues/375)).
- Diagram children with multiple `sourceConnection` entries are now parsed and serialized.
- Space-separated `targetConnections` are validated as individual connection ids.
- Saving keeps every namespace declaration on the model root (such as `xmlns:canvas`), and `xsi:type` values keep the prefix they were loaded with instead of being written as `archimate:canvas:...` ([#387](https://github.com/localgod/tsarchi/issues/387)).

## [1.0.3] - 2026-07-24

### Added

- `Archimate.getElement()`, `findElementsByName()`, `findElementsByType()`, `findElementsByFolder()`, `updateElement()` and `deleteElement()` read, change and delete elements.
- `Archimate.upsertRelationship()`, `getRelationship()`, `findRelationshipsForElement()`, `findRelationshipsBetween()` and `deleteRelationship()` work with relationships, described by a new `Relationship` interface. `upsertRelationship()` also accepts short type names such as `Flow`.
- Views can be created and edited: `createView()`, `getView()`, `listViews()`, `addDiagramObject()`, `addGroup()`, `addDiagramObjectToGroup()`, `addConnection()`, `updateDiagramObjectStyle()` and `deleteView()`, and views can be generated with `generateViewFromElements()`, `createViewByElementType()` and `createViewByFolder()`. New `View` and `ViewChild` interfaces describe them.
- `Archimate.validateModel()` returns a `ValidationIssue` for each duplicate or missing id, missing name, unknown type, and relationship, diagram object or view connection that refers to something missing. `assertValidModel()` throws an `ArchimateValidationError` holding them.
- `Archimate.hasId()` and `generateUniqueId()`, for ids that do not collide with ids already in the model.
- Typed lists of ArchiMate types per layer (`archimateBusinessElementTypes`, ..., `archimateRelationshipTypes`, `archimateViewTypes`, `archimateModelTypes`), the matching types (`ArchimateElementType`, `ArchimateRelationshipType`, `ArchimateModelType`, ...) and `isArchimateModelType()`.
- `TsArchi.getModel()` returns the loaded `Archimate` model.

### Changed

- ⚠️ `Archimate.addElement()` is replaced by `upsertElement()`, which updates the element with the same name and type when there is one, merging its properties, instead of adding a duplicate. It generates an id when none is given, and throws for an unknown type instead of logging a warning and skipping the element. `TsArchi.addElementToModel()` is removed: use `getModel().upsertElement()`.
- ⚠️ `TsArchi.saveModel()` validates the model first and throws an `ArchimateValidationError` instead of saving an invalid model.
- ⚠️ The `tsarchi` command-line tool and the `commander` dependency are removed. The sample it ran is now `examples/sample01.mts`.
- `Archimate.parse()` and `serialize()` are typed with the `Schema` interface instead of `object`.

### Fixed

- Importing the package no longer runs the command-line tool, which read the process arguments and exited when `-i` and `-o` were missing.
- Diagram children without `<bounds>` load with zero bounds instead of throwing.
- `TsArchi.loadModel()` keeps an empty model and logs a warning when the file is not an Archi model.

## [1.0.2] - 2025-08-13

### Added

- The package is published as compiled ES modules with TypeScript declarations, with a single entry point: `import { Archimate, TsArchi } from "tsarchi"`.
- `Archimate.addElement()` adds an element to the folder for its type, `findElementInFolderByName()` finds an element by name, and `generateRandomId()` is public. `TsArchi.addElementToModel()` adds an element to the loaded model.
- `folderType` and `elementTypeToFolderKey` map folders to their names and element types to their folders.
- The `sync` script is published as a `tsarchi` command-line tool. Its `bin` entry points to a file that is not in the package.

## [1.0.1] - 2025-08-12 [YANKED]

Unpublished from npm. Its changes were released in 1.0.2.

## [1.0.0] - 2025-06-03

### Added

- `Archimate.parse()` loads a parsed `.archimate` file (folders, elements, properties, diagram children with their bounds and source connections) and `serialize()` builds it back.
- `TsArchi` reads and writes `.archimate` files with `load()`, `loadModel()`, `saveModel()` and `save()`.
- A `sync` command-line script that loads a model from `-i` and saves it to `-o`.
- The package contains the TypeScript sources only, without compiled JavaScript.

[Unreleased]: https://github.com/localgod/tsarchi/compare/2.1.0...HEAD
[2.1.0]: https://github.com/localgod/tsarchi/compare/2.0.0...2.1.0
[2.0.0]: https://github.com/localgod/tsarchi/compare/1.0.3...2.0.0
[1.0.3]: https://github.com/localgod/tsarchi/releases/tag/1.0.3
[1.0.2]: https://github.com/localgod/tsarchi/releases/tag/1.0.2
[1.0.1]: https://github.com/localgod/tsarchi/tree/1.0.1
[1.0.0]: https://github.com/localgod/tsarchi/releases/tag/1.0.0
