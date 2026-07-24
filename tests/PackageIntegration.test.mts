import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { XMLParser } from 'fast-xml-parser';

const execFileAsync = promisify(execFile);

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
        const exportPath = packageJson.exports['.'].import;

        if (exportPath !== './dist/src/index.mjs') {
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
});
