# TSArchi

**TSArchi** is a TypeScript-based utility for parsing `.archimate` files and manipulating the contained ArchiMate models. The project enables reading, editing, and saving enterprise architecture models compliant with the ArchiMate standard.

- [TSArchi](#tsarchi)
  - [Introduction](#introduction)
  - [Features](#features)
  - [Installation](#installation)
  - [Upgrading from 3.x](#upgrading-from-3x)
  - [Upgrading from 2.x](#upgrading-from-2x)
  - [Upgrading from 1.x](#upgrading-from-1x)
  - [Usage](#usage)
    - [Parsing an ArchiMate File Programmatically](#parsing-an-archimate-file-programmatically)
    - [Loading and Saving Text](#loading-and-saving-text)
    - [Browser Use](#browser-use)
    - [Nested Folders](#nested-folders)
    - [Relationship Management](#relationship-management)
    - [Available Element Types](#available-element-types)
    - [View Management](#view-management)
    - [View Management Operations](#view-management-operations)
    - [Error Handling](#error-handling)
  - [Contributing](#contributing)
  - [License](#license)

## Introduction

TSArchi provides a TypeScript-based tool for parsing, modifying, and saving `.archimate` files. ArchiMate is an open, independent modeling language for enterprise architecture, and TSArchi allows you to work with these models programmatically.

## Features

- **Parsing**: Reads `.archimate` files and converts them into a TypeScript object model.
- **Model Manipulation**: Add, modify, and remove elements and relationships in the parsed model.
- **Model Serialization**: Save the modified model back into an `.archimate` file.
- **Type Safety**: Enforces strong TypeScript types for all operations on the model.
- **Clear Errors**: Files that are not well-formed XML or not Archi models throw an `ArchimateParseError`, and models are validated before they are saved.
- **Element Upsert**: Insert or update elements and relationships by `id`, merging properties.
- **Comprehensive Element Support**: Full support for all ArchiMate 3.x element types and relationships.
- **Advanced View Management**: Create, update, and manage ArchiMate diagrams with visual positioning and styling.
- **draw.io Export**: Write a view as a draw.io file, with plain rectangles or draw.io's ArchiMate 3 shapes.

## Installation

TSArchi requires [Node.js](https://nodejs.org/) 20 or later. Install it from npm:

```bash
npm install tsarchi
```

The `tsarchi` entry point holds the model API and runs in Node.js and in the browser. `TsArchi`, which reads and writes files, is imported from `tsarchi/node`. `tsarchi/bundle` is the same API as one self-contained ES module, for engines such as QuickJS (see [QuickJS](#quickjs)).

## Upgrading from 3.x

Version 4.0.0 narrows tsarchi to loading, editing, validating and saving models:

- `generateViewFromElements()`, `createViewByElementType()` and `createViewByFolder()` are removed: tsarchi no longer lays out views. Build views with `createView()`, `addDiagramObject()` and `addGroup()` with explicit bounds, and `addConnection()`.
- `upsertElement()` and `upsertRelationship()` match only on `id`. Without an `id` they always add, as names are not unique in a model. To update by name, look the element up first with `findElementsByName()` or `findRelationshipsBetween()` and pass its `id`.
- Short relationship names such as `Flow` are no longer accepted; use the full type, `FlowRelationship`. `archimateRelationshipAliasTypes`, `ArchimateRelationshipAliasType` and `resolveRelationshipType()` are removed.
- `TsArchi.load()` and `TsArchi.save()`, which read and wrote the raw XML shape, are removed. Use `loadModel()` and `saveModel()`.
- `Archimate.parse()` and `serialize()` are no longer public. Use `Archimate.fromXml()` and `toXml()` to load and save, and `snapshot()`, `restore()` and `Archimate.fromSnapshot()` for undo steps and copies (see [Snapshots](#snapshots)).
- `ViewManager`, `relationshipMatrixKeys` and `relationshipsMatrix` are no longer exported. Use the view methods on `Archimate` and `allowedRelationshipTypes()`.
- `generateRandomId()` is no longer public. Use `generateUniqueId()`, which never returns an id that is in use.
- Elements, relationships, nested folders and profiles are returned as copies, as views already are: `getElement()`, `getRelationship()`, `listElements()`, `listRelationships()`, the `find…` methods, `getFolders()`, `getProfiles()`, `getProfile()` and the return values of `upsertElement()`, `upsertRelationship()` and `updateElement()`. Changing a returned object no longer changes the model; pass the change to `updateElement()`. Diagram styling without a method of its own is changed the same way: edit `getElement(viewId).child` and write it back with `updateElement(viewId, { child })`.

## Upgrading from 2.x

Version 3.0.0 has breaking changes in how views are read and in the element type lists:

- `getView()`, `listViews()`, `createView()`, `addDiagramObject()`, `addGroup()`, `addDiagramObjectToGroup()` and `addConnection()` return copies in one shape, for views loaded from a file and views built with the API alike. Nested objects are in `children`, connections in `sourceConnections`, and the ids of the connections ending on an object in `targetConnections` (an array). All three are always present, empty when there is nothing in them. Change a view through the view methods: changing a returned view no longer changes the model.
- `ViewChild` and `ViewConnection` have every field of `Child` and `SourceConnection` (figure, features, documentation, content, …), and `ViewChild.type` is a string, as loaded views also contain types such as `DiagramModelReference` and `SketchModelSticky`.
- The stored form, with `child`, `sourceConnection` and space-separated `targetConnections` as in the file, is still available through `getElement(viewId).child`.
- `Meaning` and `Value` are motivation elements, as in Archi: they move from `archimateBusinessElementTypes` / `ArchimateBusinessElementType` to `archimateMotivationElementTypes` / `ArchimateMotivationElementType`.

## Upgrading from 1.x

Version 2.0.0 has breaking changes. The main ones:

- `TsArchi` is imported from `tsarchi/node` instead of `tsarchi`.
- `Parser`, `Serializer`, `BoundsMapper`, `SourceConnectionMapper` and `DiagramAttributeMapper` are no longer exported. Load and save models through `Archimate` and `TsArchi`.
- `TsArchi.load()` and `loadModel()` throw an `ArchimateParseError` for a file that is not an Archi model, and pass on file read errors, instead of logging them and returning an empty result.
- Every `ValidationIssue` has a `severity`. Only errors stop a model from being saved; unnamed elements, relationships that Archi's relationships matrix rejects, and element or relationship types tsarchi does not know are warnings.
- `upsertElement()` matches an existing element on `id` when one is given, instead of on `name` and `type`.
- The type lists follow Archi: types Archi never writes, such as `UsedByRelationship` and `Stage`, are removed, and short names such as `Flow` are no longer model types, though `upsertRelationship()` still accepts them. `Junction` is an element type in the Other folder.
- `View.background` is a number. `Child.sourceConnection` and the schema's `Model.folder` can be a single object or an array.

See the [changelog](CHANGELOG.md) for the full list.

## Usage

### Parsing an ArchiMate File Programmatically

You can use TSArchi programmatically in your TypeScript/JavaScript projects:

```typescript
import { TsArchi } from "tsarchi/node";

const tsArchi = new TsArchi();

// Load and parse an ArchiMate file
const model = await tsArchi.loadModel("./path/to/model.archimate");

// Add a new element; upsertElement returns a copy of the element as stored, with its id
const element = model.upsertElement({
  type: "ApplicationComponent",
  name: "My New Component",
  properties: new Map([["version", "2.0"]]),
});

// Read the model's name and contents
console.log(
  `${model.getName()} — ${model.listElements().length} elements, ${model.listRelationships().length} relationships`,
);

// Save the modified model
await tsArchi.saveModel("./path/to/output.archimate");
```

### Loading and Saving Text

`Archimate.fromXml` and `toXml` load and save the text of an `.archimate` file without touching the file system, for text from a browser file input, IPC or a test. `TsArchi` uses the same XML settings, so both give the same result:

```typescript
import { Archimate, ArchimateParseError } from "tsarchi";

try {
  const model = Archimate.fromXml(text);
  // ...
  const xml = model.toXml(); // throws ArchimateValidationError if the model has errors
} catch (error) {
  if (error instanceof ArchimateParseError) {
    // error.kind: "not-xml" | "not-archimate" | "invalid-structure"
    // error.line / error.column: where the XML is not well-formed
    console.error(error.message);
  }
}
```

`TsArchi.load` and `loadModel` throw the same `ArchimateParseError`, and pass on file read errors.

### QuickJS

QuickJS and other engines without a module resolver for `node_modules` cannot import `fast-xml-parser`, which `tsarchi` depends on. For them, the package ships `dist/bundle/tsarchi.mjs` (exported as `tsarchi/bundle`): the same API as `tsarchi`, with fast-xml-parser included, as one ES module of about 400 KB that imports nothing. Import it by its path, and load and save files with QuickJS's `std` module, as `TsArchi` needs Node's `fs`:

```javascript
import * as std from "std"; // "qjs:std" in quickjs-ng
import { Archimate } from "./node_modules/tsarchi/dist/bundle/tsarchi.mjs";

const model = Archimate.fromXml(std.loadFile("model.archimate"));
// ...
const file = std.open("model.archimate", "w");
file.puts(model.toXml());
file.close();
```

QuickJS names the module `std`; quickjs-ng, its maintained fork, names it `qjs:std` and does not accept `std`. Both run the example as is otherwise. `std.loadFile` returns `null` when the file cannot be read. With a bundler, import `tsarchi` as usual instead; the bundle is for engines that load one file as is.

### Snapshots

`snapshot()` returns the model as plain, JSON-safe data, without going through XML. `restore()` puts a snapshot back into the instance it is called on, and `Archimate.fromSnapshot()` creates a new one. Use them for undo steps, copies, and moving a model to a worker or sandbox:

```typescript
const before = model.snapshot();
model.deleteElement(elementId);
model.restore(before); // undo: the same instance, as before the delete

const copy = Archimate.fromSnapshot(JSON.parse(JSON.stringify(before)));
```

- Two models that `toXml()` would write the same way give the same snapshot, so `JSON.stringify(a.snapshot()) === JSON.stringify(b.snapshot())` tells whether they differ.
- A snapshot is new data, and `restore()` keeps no reference to it: one snapshot can be restored any number of times.
- `restore()` checks the snapshot's structure, not the model: on anything that is not a snapshot it throws an `ArchimateParseError` (`invalid-structure`) and leaves the model unchanged. Use `validateModel()` for the model itself.
- The `ModelSnapshot` format is unstable: it may change in any release, listed under **Changed** in the changelog. Use snapshots within one process and one tsarchi version, and save models as `.archimate` XML.

### Exporting a View to draw.io

`toDrawio(viewId)` returns a view as the text of a `.drawio` file (mxGraph XML), one page named after the view:

```typescript
const xml = model.toDrawio(viewId); // plain rectangles
const stencilled = model.toDrawio(viewId, { stencils: true }); // draw.io's ArchiMate 3 shapes
```

- Diagram objects, groups and notes become vertices at their bounds, using Archi's default size where none is stored. Nested children sit inside their parent, so moving a group in draw.io moves its contents.
- Connections become edges between the same cells, with bendpoints at the position Archi draws them and the relationship's ArchiMate line and arrow style. Connections that end on other connections stay connected.
- Fill, line and font colours, opacity, line width, font and text alignment are kept; diagram objects without a fill get Archi's default for their layer.
- Cell ids are the diagram object and connection ids. The export is one-way: tsarchi does not read draw.io files.

The `tsarchi` entry point uses no Node built-ins, so it can be bundled for the browser. `TsArchi` reads and writes files with `fs/promises` and is exported from `tsarchi/node` instead. In a browser, load and save with `Archimate.fromXml` and `toXml`.

### Nested Folders

User-created folders are kept on load and written back in place on save. Element lookups such as `findElementsByFolder` include elements from nested folders; `getFolders` returns the folder tree, where each folder lists the ids of the elements placed directly in it:

```typescript
for (const folder of model.getFolders("application")) {
  console.log(folder.name, folder.elementIds, folder.folders);
}
```

New elements are added at the top level of their folder.

`getFolder` returns the id, name, documentation, properties and features of a top-level folder, and `updateFolder` changes them. A detail set to `undefined`, `""` or an empty map is removed:

```typescript
const { name, documentation } = model.getFolder("business");
model.updateFolder("business", {
  documentation: "Business layer",
  properties: new Map([["Owner", "EA"]]),
});
```

`getFolderById` and `updateFolderById` do the same for any folder, nested at any depth or top-level, by its id. `getFolderById` returns `null` when there is no folder with that id, and `updateFolderById` throws:

```typescript
model.updateFolderById("id-folder-portals", { name: "Customer Portals", documentation: undefined });
```

`createFolder` adds a folder inside any folder, top-level or nested, with a generated id unless one is given. `moveFolder` moves a nested folder, with its content, to another folder of the same top-level folder, and `moveElementToFolder` moves an element, relationship or view into a folder of its own top-level folder; as in Archi, neither crosses top-level folders. `deleteFolder` deletes a nested folder with everything in it, including the relationships and diagram objects that `deleteElement` removes along with its elements:

```typescript
const { id } = model.createFolder(model.getFolder("application").id, { name: "Portals" });
model.moveElementToFolder("id-portal", id);
model.moveFolder(id, "id-folder-customer");
model.deleteFolder(id);
```

### Relationship Management

Relationships can be created and queried directly:

```typescript
const relationship = model.upsertRelationship({
  id: model.generateUniqueId(),
  name: "App Flow",
  type: "FlowRelationship",
  source: "source-element-id",
  target: "target-element-id",
});

const outgoing = model.findRelationshipsForElement("source-element-id", "source");
const between = model.findRelationshipsBetween("source-element-id", "target-element-id");

model.deleteRelationship(relationship.id);
```

To delete many elements or relationships, pass them to `deleteElements` in one call. It removes the same as `deleteElement` for each id, including attached relationships and the diagram objects and connections that show them, but goes through the model and its views once instead of once per id. It returns the ids it found:

```typescript
const deleted = model.deleteElements(unusedElementIds);
```

`findReachableElements` finds the elements within a number of relationships of an element, for example to build a view of everything around it. It returns copies of the start element first and then the others by distance, each once. Relationships that end on another relationship are not followed:

```typescript
import { ArchimateType, TraversalDirection } from "tsarchi";

// Everything within 2 relationships, either way
const nearby = model.findReachableElements("element-id", 2);

// Everything the element serves or sends a flow to, directly or indirectly
const downstream = model.findReachableElements("element-id", Infinity, {
  direction: TraversalDirection.Outgoing,
  relationshipTypes: [ArchimateType.ServingRelationship, ArchimateType.FlowRelationship],
});
```

Access relationships keep Archi's `accessType` (0 write, 1 read, 2 unspecified, 3 read/write):

```typescript
model.upsertRelationship({
  name: "reads",
  type: "AccessRelationship",
  source: "process-id",
  target: "object-id",
  accessType: 1,
});
```

Association relationships keep Archi's `directed` flag. It is `true` for a directed association and absent for an undirected one:

```typescript
model.upsertRelationship({
  name: "uses",
  type: "AssociationRelationship",
  source: "actor-id",
  target: "role-id",
  directed: true,
});
```

Influence relationships keep Archi's free-text `strength` (for example `+`, `--` or `5`), absent when none is set:

```typescript
model.upsertRelationship({
  name: "supports",
  type: "InfluenceRelationship",
  source: "goal-id",
  target: "driver-id",
  strength: "+",
});
```

`updateElement` changes an element, relationship or view by id. Keys left out are unchanged, and a key set to `undefined` removes that field (a removed `name` becomes empty, which is saved without a `name` attribute, as Archi does). `properties` is merged into the existing properties:

```typescript
model.updateElement("relationship-id", { name: undefined, documentation: undefined });
```

The model's name is available through `model.getName()` and `model.setName(name)`, and its id and file format version through `model.getId()` and `model.getVersion()`. The model's purpose text is available through `model.getPurpose()` and `model.setPurpose(text)`.

Model-level properties, metadata and specializations (profiles) are available the same way:

```typescript
model.setProperties(new Map([["Owner", "Enterprise Architecture"]]));
model.setMetadata(new Map([["creator", "tsarchi"]]));
model.setProfiles([{ id: "profile-id", name: "Premium", conceptType: "BusinessActor" }]);
model.updateElement("element-id", { profiles: "profile-id" });
```

Folders, elements, relationships and views keep their `<feature>` entries as a `features` map, in file order:

```typescript
model.updateElement("element-id", { features: new Map([["myFeature", "value"]]) });
```

Anything else that TSArchi does not recognise, on the model, its folders, elements, relationships, views, diagram objects and view connections, is kept in an `unrecognized` field and written back unchanged, so content from newer Archi versions survives a round trip.

### Available Element Types

TSArchi supports all standard ArchiMate element types organized by layers:

- **Strategy Layer**: Capability, CourseOfAction, Resource, ValueStream, etc.
- **Business Layer**: BusinessActor, BusinessRole, BusinessProcess, BusinessService, etc.
- **Application Layer**: ApplicationComponent, ApplicationService, DataObject, etc.
- **Technology Layer**: Node, Device, SystemSoftware, TechnologyService, etc.
- **Motivation Layer**: Stakeholder, Driver, Goal, Requirement, etc.
- **Implementation & Migration**: WorkPackage, Deliverable, ImplementationEvent, etc.

TypeScript consumers can import the supported type unions and runtime guard:

```typescript
import type { ArchimateElementType, ArchimateRelationshipType } from "tsarchi";
import { isArchimateModelType } from "tsarchi";

const elementType: ArchimateElementType = "ApplicationComponent";
const relationshipType: ArchimateRelationshipType = "FlowRelationship";

if (isArchimateModelType(elementType)) {
  // safe to use with typed model APIs
}
```

To pick a type or an Archi code by name instead of typing its string or number, use the named constants. They are plain frozen objects, so they also work in JavaScript without TypeScript (for example in QuickJS), where a misspelt name gives `undefined` and the method it is passed to throws:

```typescript
import { ArchimateType, AccessType, TopLevelFolder } from "tsarchi";

model.findElementsByType(ArchimateType.ApplicationComponent);
model.findElementsByFolder(TopLevelFolder.Business);
model.upsertRelationship({
  name: "",
  type: ArchimateType.AccessRelationship,
  source,
  target,
  accessType: AccessType.Read,
});
```

| Constant                                 | Values for                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `ArchimateType`                          | element, relationship and view types                                                |
| `TopLevelFolder`                         | the folder key of `findElementsByFolder`, `getFolders`, `getFolder`, `updateFolder` |
| `RelationshipDirection`                  | the direction of `findRelationshipsForElement`                                      |
| `TraversalDirection`                     | the `direction` of `findReachableElements`                                          |
| `Viewpoint`                              | the `viewpoint` of `createView`                                                     |
| `AccessType`                             | `accessType` of an Access relationship                                              |
| `TextAlignment`                          | `textAlignment` of diagram objects and groups                                       |
| `TextPosition`, `ConnectionTextPosition` | `textPosition` of diagram objects and of view connections                           |
| `ConnectionRouterType`                   | `connectionRouterType` of a view                                                    |
| `GroupBorderType`, `NoteBorderType`      | `borderType` of groups and notes                                                    |
| `DiagramObjectFigure`                    | `figure` of ArchiMate diagram objects: the box or Archi's alternate figure          |

Methods that take one of these throw on a value that is not in the list, instead of finding nothing or writing a value Archi does not know.

### View Management

TSArchi provides comprehensive view management capabilities for creating and manipulating ArchiMate diagrams:

```typescript
import { DiagramObjectFigure, TextAlignment, Viewpoint } from "tsarchi";
import { TsArchi } from "tsarchi/node";

const tsArchi = new TsArchi();
const model = await tsArchi.loadModel("./model.archimate");

// Create a new view
const view = model.createView("Application Overview", {
  viewpoint: Viewpoint.ApplicationCooperation,
  documentation: "Overview of application components",
});

// Add elements to the view with positioning
const bounds1 = { x: 100, y: 100, width: 120, height: 55 };
const bounds2 = { x: 300, y: 100, width: 120, height: 55 };

const obj1 = model.addDiagramObject(view.id, "app-component-1-id", bounds1, {
  fillColor: "#c9e7b7",
  textAlignment: TextAlignment.Left,
});

const obj2 = model.addDiagramObject(view.id, "app-component-2-id", bounds2, {
  fillColor: "#ffd93d",
  figure: DiagramObjectFigure.Alternate, // Archi's alternate figure instead of the box
});

// Create connections between elements
model.addConnection(view.id, obj1.id, obj2.id, "relationship-id", {
  lineColor: "#0066cc",
  lineWidth: 2,
});

// Create groups to organize elements
const groupBounds = { x: 50, y: 50, width: 400, height: 150 };
const group = model.addGroup(view.id, "Application Layer", groupBounds, {
  fillColor: "#e6f3ff",
  documentation: "Application layer components",
});

// Add elements to groups
model.addDiagramObjectToGroup(view.id, group.id, "another-element-id", {
  x: 20,
  y: 20,
  width: 120,
  height: 55,
});
```

### View Management Operations

```typescript
import { ArchimateType } from "tsarchi";

// List all views (ArchiMate, sketch and canvas)
const allViews = model.listViews();
console.log(`Found ${allViews.length} views`);

// List only ArchiMate views
const archimateViews = model.listViews({ type: ArchimateType.ArchimateDiagramModel });

// Get specific view. Nested objects are in `children`, connections in `sourceConnections`
// and connection ids ending on an object in `targetConnections`. The view is a copy:
// change it through the methods below.
const view = model.getView("view-id");
for (const child of view?.children ?? []) {
  console.log(child.type, child.id, child.children.length, child.sourceConnections.length);
}

// Update diagram object styling
model.updateDiagramObjectStyle("view-id", "object-id", {
  fillColor: "#ff6b6b",
  bounds: { x: 150, y: 150, width: 140, height: 65 },
  textAlignment: TextAlignment.Center,
});

// Draw an ArchiMate diagram object as Archi's alternate figure (DiagramObjectFigure.Default for the box)
model.updateDiagramObjectStyle("view-id", "object-id", { figure: DiagramObjectFigure.Alternate });

// Delete a view, and the references to it in other views
model.deleteView("view-id");
```

### Error Handling

TSArchi reports problems instead of silently changing the model:

- Loading text that is not well-formed XML or not an Archi model throws an `ArchimateParseError` (see [Loading and Saving Text](#loading-and-saving-text))
- Missing or malformed bounds data defaults to zero values
- Duplicate elements are handled gracefully with upsert operations
- View operations validate element and relationship existence
- Models are validated before saving to catch duplicate IDs, unknown types, broken relationships, broken view references, and references to missing profiles
- Relationship types are checked against Archi's relationships matrix, including its Junction rules. `upsertRelationship()` throws for a type Archi would not allow

Every issue from `validateModel()` has a `severity`. Only `error` issues stop a model from being saved. `warning` issues cover models Archi still opens and saves: unnamed elements, and relationships that Archi's matrix rejects (older models often have them). Elements and relationships with a type tsarchi does not know (`unknown-type`), such as content from a newer Archi or a plugin, are also warnings: they are kept as loaded and written back unchanged. `upsertElement()` and `upsertRelationship()` still throw for an unknown type.

```typescript
const issues = model.validateModel();

for (const issue of issues) {
  console.log(`${issue.severity}: ${issue.message}`);
}
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setting up the project, running the tests and examples, and submitting changes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE.md) file for details.
