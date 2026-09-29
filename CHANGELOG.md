# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](http://semver.org/).

This project adheres to [Keep a CHANGELOG](http://keepachangelog.com/)

## [Unreleased]

### Added

- `Archimate.getFolders(folderKey)` returns the nested folders of a top-level folder, and the new `Folder` interface describes them. Top-level folders in `Model` now share the `ModelFolder` interface, which adds optional `documentation`, `properties` and `folders`.
- Sketch (`SketchModel`) and canvas (`CanvasModel`) views are recognised as view types, so models containing them validate and can be saved ([#382](https://github.com/localgod/tsarchi/issues/382)). Canvas types are stored without their `canvas:` prefix (`CanvasModel`, `CanvasModelBlock`, ...) and get it back on save, and `xmlns:canvas` is declared when canvas views are added to a model that lacks it.
- Diagram children now keep the style and content Archi writes for ArchiMate, sketch and canvas views: `lineColor`, `lineWidth`, `lineAlpha`, `font`, `fontColor`, `alpha`, `gradient`, `textPosition`, `borderType`, `borderColor`, `iconColor`, `imagePath`, `imagePosition`, `locked`, `hintTitle`, `hintContent`, `content`, `notes`, properties and features.
- View connections now keep `name`, the line style (`type` attribute, exposed as `lineStyle`), font, line and text attributes, `locked`, documentation, bendpoints, properties and features.
- Views keep their `viewpoint`, `background` and `connectionRouterType` attributes.
- Load and save keep the remaining content Archi writes in its test models ([#386](https://github.com/localgod/tsarchi/issues/386)): the model `<purpose>` (new `getPurpose()` / `setPurpose()`), `accessType` on access relationships (`Element.accessType`, also accepted by `upsertRelationship`), the alternate figure of a diagram object (`type` attribute, exposed as `Child.figure`), and the view a `DiagramModelReference` points to (`Child.model`).

### Changed

- ⚠️ `Junction` moved from `archimateRelationshipTypes` / `ArchimateRelationshipType` to the new `archimateConnectorTypes` / `ArchimateConnectorType`, which is part of `ArchimateElementType`. New junctions are placed in the `other` folder, as Archi does, and `upsertRelationship` no longer accepts `Junction` as a relationship type ([#397](https://github.com/localgod/tsarchi/issues/397)).
- `View.type` now also allows `'SketchModel'` and `'CanvasModel'`, and `getView()` reports the actual view type.
- `Child.sourceConnection` is now typed `SourceConnection | SourceConnection[]`, matching the XML when a diagram child has several connections. Code that reads it as a single object must handle the array case.
- `SourceConnection.archimateRelationship` is now optional, since note and sketch connections have no underlying relationship.
- The schema `Model` interface now extends a new `ModelAttributes` interface, which accepts any `@_xmlns:*` namespace attribute.

### Fixed

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
