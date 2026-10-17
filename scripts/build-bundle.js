// scripts/build-bundle.js
// Bundles the built package index with fast-xml-parser into one self-contained ES module, exported as `tsarchi/bundle`,
// for engines that cannot resolve `node_modules`, such as QuickJS. Run after `tsc`.
import fs from 'fs';
import path from 'path';
import { build } from 'vite';

const entry = path.resolve('./dist/src/index.mjs');
const outDir = path.resolve('./dist/bundle');
const fileName = 'tsarchi.mjs';

const tsarchi = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const fastXmlParser = JSON.parse(fs.readFileSync('./node_modules/fast-xml-parser/package.json', 'utf8'));
const fastXmlParserLicense = fs.readFileSync('./node_modules/fast-xml-parser/LICENSE', 'utf8').trim();

// The bundle includes fast-xml-parser, so it carries that package's MIT license notice
const banner = `/*!
 * tsarchi ${tsarchi.version} (${tsarchi.license}), ${tsarchi.homepage}
 * Self-contained build with fast-xml-parser ${fastXmlParser.version} included, under this license:
 *
${fastXmlParserLicense
  .split('\n')
  .map(line => ` * ${line}`.trimEnd())
  .join('\n')}
 */`;

await build({
  configFile: false,
  logLevel: 'warn',
  build: {
    outDir,
    emptyOutDir: true,
    minify: false,
    lib: { entry, formats: ['es'], fileName: () => fileName },
    rollupOptions: { output: { banner } },
  },
});

const size = fs.statSync(path.join(outDir, fileName)).size;
process.stdout.write(`Bundled ${path.relative('.', path.join(outDir, fileName))} (${Math.round(size / 1024)} KB).\n`);
