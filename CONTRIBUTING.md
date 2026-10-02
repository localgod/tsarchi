# Contributing to TSArchi

Contributions are welcome. This guide covers setting up the project, the checks a change has to pass, and how to submit it.

## Setup

You need [Node.js](https://nodejs.org/) 20 or later. Clone the repository and install the dependencies:

```bash
git clone https://github.com/localgod/tsarchi.git
cd tsarchi
npm install
```

## Building the Project

```bash
npm run build
```

This compiles the TypeScript sources, examples and test scripts into the `dist/` folder. `src/index.mts` is generated before each build, so do not edit it.

## Tests and Checks

- `npm test` builds the project and runs the tests.
- `npm run lint` lints the code, and `npm run format` checks the formatting of the Markdown files (`npm run formatfix` fixes it).
- `npm run compare` checks that every model in `tests/fixtures/roundtrip` is saved exactly as it was loaded.
- `npm run roundtrip:diff -- [file|dir ...]` loads and saves `.archimate` files and lists what was lost, grouped by attribute or element. Run it before and after any change to loading or saving.

The goal of TSArchi is that files written by Archi are saved back unchanged, so a change to loading or saving needs a round-trip fixture:

- `tests/fixtures/archi/` holds unmodified models from the Archi repository, with their source listed in its `README.md`.
- `tests/fixtures/roundtrip/` holds hand-written models that must validate and round-trip exactly. Every file in it is tested automatically.

`*.archimate` files are ignored by git, so add new fixtures with `git add -f`.

## Running Examples

The `examples/` folder holds scripts that use the library. They take two options:

- `-i, --input <path>`: the `.archimate` file to load.
- `-o, --output <path>`: where to save the modified model.

After building, run one directly:

```bash
node ./dist/examples/sample01.mjs --input sample.archimate --output out.archimate
```

or run `sample01` on `sample.archimate` with:

```bash
npm run example
```

`sample01` loads the model, adds an Application Component unless one with the same name exists, and saves the model to the output file.

New examples go in `examples/`, are named `sampleXX.mts`, import `TsArchi` from `../src/node/TsArchi.mjs`, and parse their arguments without extra dependencies.

## Submitting Changes

1. Fork the repository.
2. Create a branch (`git checkout -b feat/my-feature`).
3. Commit your changes. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, with `!` for a breaking change).
4. Add an entry under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md), in Added, Changed or Fixed, linking the issue. Mark breaking changes with ⚠️.
5. Push the branch and open a pull request. Describe the problem, the changes, how they are tested, and what is out of scope, with follow-up issues filed for anything left.
