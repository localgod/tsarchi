import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { XMLParser } from 'fast-xml-parser';

const execFileAsync = promisify(execFile);

type PackResult = { files: { path: string }[] };

describe('package integration', () => {
  it('imports from the declared package export and preserves root metadata when saving', async () => {
    const sourcePath = new URL('../sample.archimate', import.meta.url);
    const sourceXml = await readFile(sourcePath, 'utf8');
    const inputXml = sourceXml
      .replace('id="id-d81fe19001de4c3cb53c05c2b757d35d"', 'id="id-custom-root"')
      .replace('version="5.0.0"', 'version="9.9.9"');

    const tempDir = await mkdtemp(join(tmpdir(), 'tsarchi-'));
    const inputPath = join(tempDir, 'input.archimate');
    const outputPath = join(tempDir, 'output.archimate');

    try {
      await writeFile(inputPath, inputXml, 'utf8');

      const runnerPath = join(process.cwd(), '.tmp-package-integration.mjs');
      await writeFile(
        runnerPath,
        `
        import { readFile } from 'fs/promises';

        const packageJson = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
        const exportPath = packageJson.exports['./node'].import;

        if (exportPath !== './dist/src/node/index.mjs') {
          throw new Error(\`Unexpected package export path: \${exportPath}\`);
        }

        const { TsArchi } = await import(exportPath);

        if (typeof TsArchi !== 'function') {
          throw new Error('TsArchi package export path is not constructible');
        }

        const tsArchi = new TsArchi();
        const model = await tsArchi.loadModel(${JSON.stringify(inputPath)});
        const viewNames = model.listViews().map((view) => view.name);

        if (!viewNames.includes('Default View')) {
          throw new Error('Default View was not loaded through the package export');
        }

        await tsArchi.saveModel(${JSON.stringify(outputPath)});
        `,
        'utf8'
      );

      try {
        await execFileAsync(process.execPath, [runnerPath], {
          cwd: process.cwd(),
        });
      } finally {
        await rm(runnerPath, { force: true });
      }

      const outputXml = await readFile(outputPath, 'utf8');
      const parsed = new XMLParser({ ignoreAttributes: false }).parse(outputXml);

      expect(parsed['archimate:model']['@_id']).toBe('id-custom-root');
      expect(parsed['archimate:model']['@_version']).toBe('9.9.9');
      expect(outputXml).toContain('name="Default View"');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('publishes only the compiled library, without tests or examples', async () => {
    const { stdout } = await execFileAsync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: process.cwd() });
    // npm 11 prints an array of packages, npm 12 an object keyed by package name.
    const packed = JSON.parse(stdout) as PackResult[] | Record<string, PackResult>;
    const [{ files }] = Array.isArray(packed) ? packed : Object.values(packed);
    const paths = files.map((file) => file.path);

    expect(paths).toContain('dist/src/index.mjs');
    expect(paths).toContain('dist/src/node/index.mjs');
    expect(paths.filter((path) => !path.startsWith('dist/src/')).sort()).toEqual(['LICENSE.md', 'README.md', 'package.json']);
  });
});

describe('public API', () => {
  it('keeps internal modules out of the package index', async () => {
    const index = await import('../src/index.mjs');

    expect(index).toHaveProperty('Archimate');
    expect(index).not.toHaveProperty('TsArchi');
    expect(index).not.toHaveProperty('DiagramAttributeMapper');
    expect(index).not.toHaveProperty('childAttributes');
    expect(index).not.toHaveProperty('connectionAttributes');
    expect(index).not.toHaveProperty('Parser');
    expect(index).not.toHaveProperty('Serializer');
    expect(index).not.toHaveProperty('BoundsMapper');
    expect(index).not.toHaveProperty('SourceConnectionMapper');
  });

  it('exports TsArchi from the node entry point', async () => {
    const node = await import('../src/node/index.mjs');

    expect(Object.keys(node)).toEqual(['TsArchi']);
  });
});
