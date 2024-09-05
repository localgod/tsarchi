Here is the amended `README.md` to reflect the new way of calling the program using `node ./dist/tsarchi.mjs` with the required arguments `--input` and `--output`:

---

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
    - [Running TSArchi](#running-tsarchi)
      - [Example Command:](#example-command)
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

### Running TSArchi

You can run the program via the command line using `node ./dist/tsarchi.mjs` with the following required arguments:

- `--input <path>`: The path to the input `.archimate` file you wish to parse and manipulate.
- `--output <path>`: The path where the modified model will be saved as a `.archimate` file.

#### Example Command:

```bash
node ./dist/tsarchi.mjs --input ./models/example.archimate --output ./models/output.archimate
```

This command will:
1. Parse the model in `./models/example.archimate`.
2. Save the modified model to `./models/output.archimate`.

You can extend the commands to do manipulations of the object model

### Parsing an ArchiMate File Programmatically

This functionality is coming

## Contributing

We welcome contributions! Please follow these steps to contribute to the project:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/my-feature`).
3. Commit your changes (`git commit -am 'Add my feature'`).
4. Push to the branch (`git push origin feature/my-feature`).
5. Create a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
