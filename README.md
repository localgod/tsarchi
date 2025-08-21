# TSArchi

**TSArchi** is a TypeScript-based utility for parsing `.archimate` files and manipulating the contained ArchiMate models. The project enables reading, editing, and saving enterprise architecture models compliant with the ArchiMate standard.

- [TSArchi](#tsarchi)
  - [Introduction](#introduction)
  - [Features](#features)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Building the Project](#building-the-project)
  - [Usage](#usage)
    - [Running Examples](#running-examples)
      - [Example Commands](#example-commands)
    - [Parsing an ArchiMate File Programmatically](#parsing-an-archimate-file-programmatically)
  - [Contributing](#contributing)
  - [License](#license)

## Introduction

TSArchi provides a TypeScript-based tool for parsing, modifying, and saving `.archimate` files. ArchiMate is an open, independent modeling language for enterprise architecture, and TSArchi allows you to work with these models programmatically.

## Features

- **Parsing**: Reads `.archimate` files and converts them into a TypeScript object model.
- **Model Manipulation**: Add, modify, and remove elements and relationships in the parsed model.
- **Model Serialization**: Save the modified model back into an `.archimate` file.
- **Type Safety**: Enforces strong TypeScript types for all operations on the model.
- **Error Resilience**: Graceful handling of invalid XML, missing data, and malformed files.
- **Element Upsert**: Smart insert/update operations that preserve existing IDs while updating properties.
- **Comprehensive Element Support**: Full support for all ArchiMate 3.x element types and relationships.
- **Advanced View Management**: Create, update, and manage ArchiMate diagrams with visual positioning and styling.
- **Auto-layout Capabilities**: Generate views automatically with grid, circular, or hierarchical layouts.

## Getting Started

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v20 or later)
- [npm](https://www.npmjs.com/)

### Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/localgod/tsarchi.git
    cd tsarchi
    ```

2. Install the dependencies:

    ```bash
    npm install
    ```

### Building the Project

Before running the project, you need to compile the TypeScript files:

```bash
npm run build
```

This will compile the TypeScript source files into the `dist/` folder.

## Usage

### Running Examples

TSArchi includes example scripts that demonstrate how to use the library:

- `--input <path>`: The path to the input `.archimate` file you wish to parse and manipulate.
- `--output <path>`: The path where the modified model will be saved as a `.archimate` file.

#### Example Commands

Running the sample example directly:

```bash
node ./dist/examples/sample01.mjs --input ./models/example.archimate --output ./models/output.archimate
```

Or using npm script:

```bash
npm run example
```

The example script will:

1. Parse the model in the input file.
2. Add a new Application Component (if it doesn't already exist).
3. Save the modified model to the output file.

#### Creating Your Own Examples

You can create additional examples in the `examples/` folder. Each example should:

- Import TSArchi from `../src/TsArchi.mjs`
- Use native Node.js argument parsing (no external dependencies)
- Follow the naming pattern `sampleXX.mts`

### Parsing an ArchiMate File Programmatically

You can use TSArchi programmatically in your TypeScript/JavaScript projects:

```typescript
import { TsArchi } from 'tsarchi';

const tsArchi = new TsArchi();

// Load and parse an ArchiMate file
const model = await tsArchi.loadModel('./path/to/model.archimate');

// Add a new element
const newElement = {
  id: model.generateRandomId(),
  type: 'ApplicationComponent',
  name: 'My New Component',
  properties: new Map([['version', '2.0']])
};

model.upsertElement(newElement);

// Save the modified model
await tsArchi.saveModel('./path/to/output.archimate');
```

#### Available Element Types

TSArchi supports all standard ArchiMate element types organized by layers:

- **Strategy Layer**: Capability, CourseOfAction, Resource, ValueStream, etc.
- **Business Layer**: BusinessActor, BusinessRole, BusinessProcess, BusinessService, etc.
- **Application Layer**: ApplicationComponent, ApplicationService, DataObject, etc.
- **Technology Layer**: Node, Device, SystemSoftware, TechnologyService, etc.
- **Motivation Layer**: Stakeholder, Driver, Goal, Requirement, etc.
- **Implementation & Migration**: WorkPackage, Deliverable, ImplementationEvent, etc.

#### View Management

TSArchi provides comprehensive view management capabilities for creating and manipulating ArchiMate diagrams:

```typescript
import { TsArchi } from 'tsarchi';

const tsArchi = new TsArchi();
const model = await tsArchi.loadModel('./model.archimate');

// Create a new view
const view = model.createView('Application Overview', {
  viewpoint: 'application',
  documentation: 'Overview of application components'
});

// Add elements to the view with positioning
const bounds1 = { x: 100, y: 100, width: 120, height: 55 };
const bounds2 = { x: 300, y: 100, width: 120, height: 55 };

const obj1 = model.addDiagramObject(view.id, 'app-component-1-id', bounds1, {
  fillColor: '#c9e7b7',
  textAlignment: 1
});

const obj2 = model.addDiagramObject(view.id, 'app-component-2-id', bounds2, {
  fillColor: '#ffd93d'
});

// Create connections between elements
model.addConnection(view.id, obj1.id, obj2.id, 'relationship-id', {
  lineColor: '#0066cc',
  lineWidth: 2
});

// Create groups to organize elements
const groupBounds = { x: 50, y: 50, width: 400, height: 150 };
const group = model.addGroup(view.id, 'Application Layer', groupBounds, {
  fillColor: '#e6f3ff',
  documentation: 'Application layer components'
});

// Add elements to groups
model.addDiagramObjectToGroup(view.id, group.id, 'another-element-id', 
  { x: 20, y: 20, width: 120, height: 55 });
```

#### Auto-generating Views

Create views automatically from existing model elements:

```typescript
// Generate view from specific elements
const elementIds = ['comp-1', 'comp-2', 'comp-3'];
const generatedView = model.generateViewFromElements('Generated View', elementIds, {
  layoutType: 'grid',
  includeRelationships: true,
  viewpoint: 'application'
});

// Create view from all elements of a specific type
const appView = model.createViewByElementType('Application Components', 'ApplicationComponent', {
  layoutType: 'circular',
  includeRelationships: true
});

// Create view from all elements in a folder
const businessView = model.createViewByFolder('Business Overview', 'business', {
  layoutType: 'hierarchical'
});
```

#### View Management Operations

```typescript
// List all views
const allViews = model.listViews();
console.log(`Found ${allViews.length} views`);

// Get specific view
const view = model.getView('view-id');

// Update diagram object styling
model.updateDiagramObjectStyle('view-id', 'object-id', {
  fillColor: '#ff6b6b',
  bounds: { x: 150, y: 150, width: 140, height: 65 },
  textAlignment: 2
});

// Delete a view
model.deleteView('view-id');
```

#### Error Handling

TSArchi includes robust error handling:

- Invalid XML files return empty objects instead of throwing errors
- Missing or malformed bounds data defaults to zero values
- Duplicate elements are handled gracefully with upsert operations
- View operations validate element and relationship existence

## Contributing

We welcome contributions! Please follow these steps to contribute to the project:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/my-feature`).
3. Commit your changes (`git commit -am 'Add my feature'`).
4. Push to the branch (`git push origin feature/my-feature`).
5. Create a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
