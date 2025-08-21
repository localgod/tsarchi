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

#### Error Handling

TSArchi includes robust error handling:

- Invalid XML files return empty objects instead of throwing errors
- Missing or malformed bounds data defaults to zero values
- Duplicate elements are handled gracefully with upsert operations

## Contributing

We welcome contributions! Please follow these steps to contribute to the project:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/my-feature`).
3. Commit your changes (`git commit -am 'Add my feature'`).
4. Push to the branch (`git push origin feature/my-feature`).
5. Create a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
