# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](http://semver.org/).

This project adheres to [Keep a CHANGELOG](http://keepachangelog.com/)

## [Unreleased]

### Added

- `Archimate.getFolders(folderKey)` returns the nested folders of a top-level folder, and the new `Folder` interface describes them. Top-level folders in `Model` now share the `ModelFolder` interface, which adds optional `documentation`, `properties` and `folders`.

### Changed

- `Child.sourceConnection` is now typed `SourceConnection | SourceConnection[]`, matching the XML when a diagram child has several connections. Code that reads it as a single object must handle the array case.
- `SourceConnection.archimateRelationship` is now optional, since note and sketch connections have no underlying relationship.
- The schema `Model` interface now extends a new `ModelAttributes` interface, which accepts any `@_xmlns:*` namespace attribute.

### Fixed

- Nested folders are no longer dropped. Their elements are loaded into the top-level folder's `elements` list, and the folders are saved back in place with their name, id, documentation and properties ([#376](https://github.com/localgod/tsarchi/issues/376)).
- Top-level folders keep their name and documentation on save instead of being reset to the default name.

- Parsing no longer throws on view connections without `xsi:type` (as written by Archi in sketch and canvas models). They default to `Connection` and are saved without the attribute ([#375](https://github.com/localgod/tsarchi/issues/375)).
- Diagram children with multiple `sourceConnection` entries are now parsed and serialized.
- Space-separated `targetConnections` are validated as individual connection ids.
- Saving keeps every namespace declaration on the model root (such as `xmlns:canvas`), and `xsi:type` values keep the prefix they were loaded with instead of being written as `archimate:canvas:...` ([#387](https://github.com/localgod/tsarchi/issues/387)).
