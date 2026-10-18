import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite-plus';

const root = path.dirname(fileURLToPath(import.meta.url));
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, any>;

interface BundledPackage {
  name: string;
  version: string;
  license: string;
  author: string;
  licenseText: string | undefined;
}

/**
 * The installed copies of tsarchi's dependencies and theirs, found as Node resolves them, so a nested copy of another
 * version is listed as well. These are what the bundle inlines.
 */
function bundledPackages(): BundledPackage[] {
  const found = new Map<string, BundledPackage>();
  const visit = (name: string, fromDir: string) => {
    let dir = fromDir;
    while (!fs.existsSync(path.join(dir, 'node_modules', name, 'package.json'))) {
      if (path.dirname(dir) === dir) throw new Error(`Cannot find the installed package ${name}, needed by ${fromDir}.`);
      dir = path.dirname(dir);
    }
    const packageDir = path.join(dir, 'node_modules', name);
    if (found.has(packageDir)) return;
    const pkg = readJson(path.join(packageDir, 'package.json'));
    const licenseFile = fs.readdirSync(packageDir).find(file => /^licen[cs]e/i.test(file));
    found.set(packageDir, {
      name,
      version: pkg.version,
      license: pkg.license,
      author: typeof pkg.author === 'string' ? pkg.author : pkg.author?.name,
      licenseText: licenseFile && fs.readFileSync(path.join(packageDir, licenseFile), 'utf8').trim(),
    });
    for (const dependency of Object.keys(pkg.dependencies ?? {})) visit(dependency, packageDir);
  };
  for (const dependency of Object.keys(readJson(path.join(root, 'package.json')).dependencies ?? {})) visit(dependency, root);
  return [...found.values()];
}

/** The bundle's header: the license notices of every package it includes, as their licenses require. */
function bundleBanner(packages: BundledPackage[]): string {
  const tsarchi = readJson(path.join(root, 'package.json'));
  const label = (pkg: BundledPackage) => `${pkg.name} ${pkg.version}`;
  // Packages with the same license text share one copy of it
  const byText = new Map<string, BundledPackage[]>();
  for (const pkg of packages.filter(pkg => pkg.licenseText)) byText.set(pkg.licenseText!, [...(byText.get(pkg.licenseText!) ?? []), pkg]);
  const sections = [
    ...[...byText].map(([text, group]) => `${group.map(label).join(', ')}:\n\n${text}`),
    ...packages
      .filter(pkg => !pkg.licenseText)
      .map(pkg => `${label(pkg)}: ${pkg.license}${pkg.author ? `, by ${pkg.author}` : ''}. The package ships no license file.`),
  ];
  const comment = [
    `tsarchi ${tsarchi.version} (${tsarchi.license}), ${tsarchi.homepage}`,
    `Self-contained build with ${packages.map(label).join(', ')} included, under these licenses:`,
    ...sections.flatMap(section => ['', ...section.split('\n')]),
  ];
  return `/*!\n${comment.map(line => ` * ${line.replaceAll('*/', '* /')}`.trimEnd()).join('\n')}\n */`;
}

const packages = bundledPackages();

export default defineConfig({
  // `tsarchi/bundle`: the package index with its dependencies inlined, as one ES module for engines that cannot resolve
  // `node_modules`, such as QuickJS. The rest of `dist/` is built by tsc.
  pack: {
    entry: { tsarchi: 'src/index.mts' },
    outDir: 'dist/bundle',
    format: 'esm',
    platform: 'browser',
    // As tsc compiles src/, so the bundle runs where the package does
    target: 'es2020',
    dts: false,
    minify: false,
    outExtensions: () => ({ js: '.mjs' }),
    // Inline every dependency, and fail if the bundle includes a package whose license is not in the banner
    deps: { alwaysBundle: [/.*/], onlyBundle: [...new Set(packages.map(pkg => pkg.name))] },
    banner: { js: bundleBanner(packages) },
  },
  fmt: {
    // Generated files, and files outside the paths `npm run format` checks (formatting package.json would re-sort its keys).
    ignorePatterns: [
      'src/index.mts',
      'src/internal/relationships-matrix.mts',
      '.claude/**',
      '.devcontainer/**',
      '.github/**',
      '.vscode/**',
      'package.json',
      'tsconfig.json',
    ],
    overrides: [
      {
        files: ['*.mts', '*.ts', '*.mjs', '*.js'],
        options: {
          singleQuote: true,
          trailingComma: 'es5',
          printWidth: 140,
          arrowParens: 'avoid',
        },
      },
    ],
  },
  lint: {
    overrides: [
      {
        files: ['src/**'],
        rules: {
          'no-console': 'error',
          'no-restricted-globals': [
            'error',
            {
              name: 'structuredClone',
              message: 'QuickJS has no structuredClone; use deepCopy from src/internal/Copy.mts.',
            },
          ],
        },
      },
    ],
    jsPlugins: [
      {
        name: 'vite-plus',
        specifier: 'vite-plus/oxlint-plugin',
      },
    ],
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
      // XML values are typed `unknown` (fast-xml-parser may return numbers or booleans) and are stringified on purpose.
      'typescript/no-base-to-string': 'off',
      // Errors for unknown types print the rejected value, which a failed type guard narrows to `never`.
      'typescript/restrict-template-expressions': 'off',
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
