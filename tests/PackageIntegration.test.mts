import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { XMLParser } from 'fast-xml-parser';
import { TsArchi } from 'tsarchi';

describe('package integration', () => {
  it('imports from the package export and preserves root metadata when saving', async () => {
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

      const tsArchi = new TsArchi();
      const model = await tsArchi.loadModel(inputPath);
      expect(model.listViews().map((view) => view.name)).toContain('Default View');

      await tsArchi.saveModel(outputPath);

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
