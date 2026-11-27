# TSArchi

**TSArchi** is a TypeScript library that loads, edits, validates and saves the `.archimate` files of [Archi](https://www.archimatetool.com/), the ArchiMate modelling tool. Files written by Archi are saved back unchanged, including content tsarchi does not map.

- [TSArchi](#tsarchi)
  - [Features](#features)
  - [Installation](#installation)
  - [Upgrading from 4.x](#upgrading-from-4x)
  - [Upgrading from 3.x](#upgrading-from-3x)
  - [Usage](#usage)
    - [Loading and Saving Files](#loading-and-saving-files)
    - [Loading and Saving Text](#loading-and-saving-text)
    - [Browser Use](#browser-use)
    - [QuickJS](#quickjs)
    - [Snapshots](#snapshots)
    - [Exporting a View to draw.io](#exporting-a-view-to-drawio)
    - [Nested Folders](#nested-folders)
    - [Relationship Management](#relationship-management)
    - [Properties](#properties)
    - [Features and Unrecognized Content](#features-and-unrecognized-content)
    - [Available Element Types](#available-element-types)
    - [View Management](#view-management)
    - [View Management Operations](#view-management-operations)
    - [Error Handling](#error-handling)
  - [Contributing](#contributing)
  - [License](#license)

## Features

- **Lossless load and save**: Archi files round-trip unchanged, including newer Archi styling and content tsarchi does not map.
- **Model editing**: Add, change, move and delete elements, relationships, views, folders, properties and specializations, with ids kept unique.
- **Views**: Build views from diagram objects, groups and connections with explicit bounds, restyle, move, remove and duplicate their contents. Layout is left to callers.
- **Validation**: Models are checked before they are saved: duplicate ids, broken references, unknown types, and relationship types against Archi's relationships matrix, including its Junction rules.
- **Clear errors**: Text that is not well-formed XML or not an Archi model throws an `ArchimateParseError`.
- **Every ArchiMate 3 type**: All element, relationship and view types Archi writes, as TypeScript types and named constants.
- **Snapshots**: The model as plain JSON-safe data, for undo, copies and workers.
- **draw.io export**: Write a view as a draw.io file, with plain rectangles or draw.io's ArchiMate 3 shapes.
- **Runs anywhere**: Node.js, browsers and QuickJS.

## Installation

TSArchi requires [Node.js](https://nodejs.org/) 20 or later. Install it from npm:

```bash
npm install tsarchi
```

The `tsarchi` entry point holds the model API and runs in Node.js and in the browser. `loadModel` and `saveModel`, which read and write files, are imported from `tsarchi/node`. `tsarchi/bundle` is the same API as one self-contained ES module, for engines such as QuickJS (see [QuickJS](#quickjs)).

## Upgrading from 4.x

Version 5.0.0 makes the model types hold what the file holds, and replaces two APIs:

- `properties` on models, folders, elements, relationships, views, diagram objects and view connections is a `Property[]` of `{ key, value }` instead of a `Map<string, string>`: an ordered list in which a key may appear more than once, as in Archi (see [Properties](#properties)). Read a value with `getProperty(properties, key)` instead of `properties.get(key)`.
- `getProperties()` and `getMetadata()` return a `Property[]`, and `setProperties()` and `setMetadata()` take one. Model metadata keeps repeated keys too.
- `updateElement()` and `upsertElement()` replace the whole `properties` list instead of merging it by key. To change one key, pass `setProperty(element.properties, key, value)`.
- `updateFolder()`, `updateFolderById()` and `createFolder()` take a `properties` list; an empty list removes the properties.
- `TsArchi` is removed. `tsarchi/node` exports two functions instead: `loadModel(path)` returns the model, and `saveModel(model, path)` saves any model, not only the last one loaded.
- `addDiagramObjectToGroup(viewId, groupId, elementId, bounds, options)` is removed. Use `addDiagramObject(viewId, elementId, bounds, { ...options, parentId: groupId })`, which also adds into an ArchiMate diagram object.
- `Element.profiles`, `Child.targetConnections` and `SourceConnection.targetConnections` are arrays of ids instead of space-separated strings. An empty array is not written.
- `Element.child`, `Child.sourceConnection` and `SourceConnection.sourceConnection` are always arrays, also for a single child or connection. Code that wrote a single object, for example through `updateElement(viewId, { child })`, passes a one-item array.

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

Upgrade notes for earlier versions are in the [changelog](CHANGELOG.md) under 3.0.0 and 2.0.0.

## Usage

### Loading and Saving Files

In Node.js, `loadModel` and `saveModel` from `tsarchi/node` read and write `.archimate` files:

```typescript
import { loadModel, saveModel } from "tsarchi/node";

// Load and parse an ArchiMate file
const model = await loadModel("./path/to/model.archimate");

// Add a new element; upsertElement returns a copy of the element as stored, with its id
const element = model.upsertElement({
  type: "ApplicationComponent",
  name: "My New Component",
  properties: [{ key: "version", value: "2.0" }],
});

// Read the model's name and contents
console.log(
  `${model.getName()} — ${model.listElements().length} elements, ${model.listRelationships().length} relationships`,
);

// Save the modified model
await saveModel(model, "./path/to/output.archimate");
```

### Loading and Saving Text

`Archimate.fromXml` and `toXml` load and save the text of an `.archimate` file without touching the file system, for text from a browser file input, IPC or a test. `loadModel` and `saveModel` use the same XML settings, so both give the same result:

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

`loadModel` throws the same `ArchimateParseError`, and passes on file read errors.

### Browser Use

The `tsarchi` entry point uses no Node built-ins, so it can be bundled for the browser. `loadModel` and `saveModel` read and write files with `fs/promises` and are exported from `tsarchi/node` instead. In a browser, load and save with `Archimate.fromXml` and `toXml`.

### QuickJS

QuickJS and other engines without a module resolver for `node_modules` cannot import `fast-xml-parser`, which `tsarchi` depends on. For them, the package ships `dist/bundle/tsarchi.mjs` (exported as `tsarchi/bundle`): the same API as `tsarchi`, with fast-xml-parser and its dependencies included, as one ES module of about 400 KB that imports nothing. Import it by its path, and load and save files with QuickJS's `std` module, as `loadModel` and `saveModel` need Node's `fs`:

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

### Nested Folders

User-created folders are kept on load and written back in place on save. Element lookups such as `findElementsByFolder` include elements from nested folders; `getFolders` returns the folder tree, where each folder lists the ids of the elements placed directly in it:

```typescript
for (const folder of model.getFolders("application")) {
  console.log(folder.name, folder.elementIds, folder.folders);
}
```

New elements are added at the top level of their folder.

`getFolder` returns the id, name, documentation, properties and features of a top-level folder, and `updateFolder` changes them. A detail set to `undefined`, `""`, an empty list or an empty map is removed:

```typescript
const { name, documentation } = model.getFolder("business");
model.updateFolder("business", {
  documentation: "Business layer",
  properties: [{ key: "Owner", value: "EA" }],
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

`updateElement` changes an element, relationship or view by id. Keys left out are unchanged, and a key set to `undefined` removes that field (a removed `name` becomes empty, which is saved without a `name` attribute, as Archi does). `properties` replaces the whole list (see [Properties](#properties)):

```typescript
model.updateElement("relationship-id", { name: undefined, documentation: undefined });
```

The model's name is available through `model.getName()` and `model.setName(name)`, and its id and file format version through `model.getId()` and `model.getVersion()`. The model's purpose text is available through `model.getPurpose()` and `model.setPurpose(text)`.

Model-level properties, metadata and specializations (profiles) are available the same way:

```typescript
model.setProperties([{ key: "Owner", value: "Enterprise Architecture" }]);
model.setMetadata([{ key: "creator", value: "tsarchi" }]);
model.setProfiles([{ id: "profile-id", name: "Premium", conceptType: "BusinessActor" }]);
model.updateElement("element-id", { profiles: ["profile-id"] });
```

### Properties

Models, folders, elements, relationships, views, diagram objects and view connections keep their `<property>` entries as a `properties` list of `{ key, value }`, in file order. As in Archi, a key may appear more than once. A key or value the file leaves out (Archi does for an empty one) is left out of the entry too.

The property helpers read a list and return changed copies, following jArchi's `prop()` and `removeProp()`. They treat a missing key or value as `""`:

| Helper                                    | Returns                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `getProperty(properties, key)`            | The value of the first property with the key, or `undefined`                                  |
| `getPropertyValues(properties, key)`      | The values of every property with the key                                                     |
| `getPropertyKeys(properties)`             | Each key once, in the order they first appear                                                 |
| `setProperty(properties, key, value)`     | A copy with every property of the key set to the value, or with the property added at the end |
| `addProperty(properties, key, value)`     | A copy with the property added at the end, even when the key is already there                 |
| `removeProperty(properties, key, value?)` | A copy without the properties of the key, or only those with the given value                  |

Pass the result to `updateElement`, `updateFolder` or `setProperties`, which replace the whole list:

```typescript
import { getProperty, setProperty } from "tsarchi";

const element = model.getElement("element-id")!;
const owner = getProperty(element.properties, "Owner");
model.updateElement("element-id", {
  properties: setProperty(element.properties, "Status", "Approved"),
});
```

### Features and Unrecognized Content

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
import { loadModel } from "tsarchi/node";

const model = await loadModel("./model.archimate");

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

// Add elements into a group, or into another element's diagram object, with bounds relative to it
model.addDiagramObject(
  view.id,
  "another-element-id",
  { x: 20, y: 20, width: 120, height: 55 },
  { parentId: group.id },
);
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

// Take a diagram object (or a group, note or view reference) off a view, with what is nested in it and every
// connection to or from any of them. The elements and relationships they show stay in the model.
// Returns the ids of everything removed, empty if the view or object is not found.
const removedIds = model.removeDiagramObject("view-id", "object-id");

// Take a connection off a view, with the connections attached to it. The relationship stays in the model.
model.removeConnection("view-id", "connection-id");

// Take several diagram objects and connections off a view at once, such as an editor's selection.
// It removes the same as the two methods above for each id, in one pass over the view.
model.removeFromView("view-id", ["object-id", "connection-id"]);

// Move a diagram object (or a group, note, …) to another parent in the same view: into a group, an element's
// diagram object, a sketch sticky or a canvas block, or onto the view with null. Bounds are relative to the new parent.
// It goes last among the parent's children (on top) unless given an index, and keeps its id, nested objects and connections.
// Returns where it was, so calling it again with that and the old bounds undoes the move; null if the move is refused.
const from = model.moveDiagramObject("view-id", "object-id", "group-id", {
  x: 24,
  y: 36,
  width: 120,
  height: 55,
});
// Undo, with the bounds it had before: model.moveDiagramObject("view-id", "object-id", from.parentId, oldBounds, { index: from.index });

// Duplicate a view, as Archi's Duplicate does: everything drawn on it, with new ids, referring to the same
// elements and relationships. The copy goes at the end of the original's folder, named "<name> (copy)" unless given a name.
const copy = model.duplicateView("view-id", { name: "Variant" });

// Delete a view, and the references to it in other views
model.deleteView("view-id");
```

### Error Handling

TSArchi reports problems instead of silently changing the model:

- Loading text that is not well-formed XML or not an Archi model throws an `ArchimateParseError` (see [Loading and Saving Text](#loading-and-saving-text))
- Bounds are read as Archi writes them: a missing attribute takes Archi's default (0 for `x` and `y`, -1 for `width` and `height`, which means the default size), a value that is not a number reads as 0, and a diagram object without `<bounds>` gets zero bounds
- `upsertElement()` and `upsertRelationship()` match on `id`, and throw when the id is already used by something else
- `addDiagramObject()`, `addGroup()` and `addConnection()` return `null` when the view does not exist, and throw when the element, relationship, parent or diagram object they refer to does not; the update and remove methods return `false` or an empty list instead
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

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
