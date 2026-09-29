import { describe, expect, it } from 'vitest';
import { readFile } from 'fs/promises';
import { XMLParser } from 'fast-xml-parser';
import { Archimate } from '../src/Archimate.mjs';
import type { Schema } from '../src/interfaces/schema/Schema.mjs';
import type { SourceConnection as SchemaSourceConnection } from '../src/interfaces/schema/SourceConnection.mjs';
import { SourceConnectionMapper } from '../src/SourceConnectionMapper.mjs';

const fixturesDir = 'tests/fixtures/archi';

async function parseFixture(name: string): Promise<Archimate> {
  const xml = await readFile(`${fixturesDir}/${name}`, 'utf8');
  const raw = new XMLParser({ ignoreAttributes: false }).parse(xml) as Schema;
  const archimate = new Archimate();
  archimate.parse(raw);
  return archimate;
}

function collectSourceConnections(node: unknown, found: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) {
    node.forEach(item => collectSourceConnections(item, found));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'sourceConnection') {
        found.push(...(Array.isArray(value) ? value : [value]));
      }
      collectSourceConnections(value, found);
    }
  }
  return found;
}

describe('Archi-produced models', () => {
  it.each(['Archisurance.archimate', 'testDeleteHandler.archimate'])(
    'should not report missing-name for unnamed relationships in %s',
    async (name) => {
      const archimate = await parseFixture(name);
      expect(archimate.validateModel().filter(issue => issue.code === 'missing-name')).toEqual([]);
    }
  );

  it('should recognise Location as an element type', async () => {
    const archimate = await parseFixture('test.archimate');
    expect(archimate.validateModel()).toEqual([]);
  });

  it('should accept relationships as relationship endpoints', async () => {
    const archimate = await parseFixture('testCopySnapshot.archimate');
    const codes = archimate.validateModel().map(issue => issue.code);

    expect(codes).not.toContain('relationship-missing-source');
    expect(codes).not.toContain('relationship-missing-target');
  });

  it.each(['Archisurance.archimate', 'test.archimate', 'testCopySnapshot.archimate'])(
    'should parse %s',
    async (name) => {
      await expect(parseFixture(name)).resolves.toBeInstanceOf(Archimate);
    }
  );

  it('should serialize connections without xsi:type without adding the attribute', async () => {
    const archimate = await parseFixture('testCopySnapshot.archimate');
    const connections = collectSourceConnections(archimate.serialize());

    expect(connections.length).toBeGreaterThan(0);
    expect(connections.every(connection => typeof connection['@_id'] === 'string')).toBe(true);
    expect(connections.filter(connection => !('@_xsi:type' in connection)).map(connection => connection['@_id']))
      .toEqual(expect.arrayContaining(['01707f8e', '807d8f49', 'b0b06ebb', '80ce8eea', 'b5266c15', '8faa57ef']));
  });

  it('should keep all namespace declarations on the model root', async () => {
    const archimate = await parseFixture('test.archimate');
    const model = archimate.serialize()['archimate:model'];

    expect(Object.keys(model).filter(key => key.startsWith('@_xmlns:'))).toEqual([
      '@_xmlns:xsi',
      '@_xmlns:archimate',
      '@_xmlns:canvas',
    ]);
    expect(model['@_xmlns:canvas']).toBe('http://www.archimatetool.com/archimate/canvas');
  });

  it('should keep the xsi:type prefix a type was loaded with', async () => {
    const archimate = await parseFixture('test.archimate');
    const diagrams = archimate.serialize()['archimate:model'].folder.find(folder => folder['@_type'] === 'diagrams');
    const canvas = diagrams?.element.find(element => element['@_id'] === '25d4e8d4-f410-4a1a-bc28-f184d66ea408');
    const childTypes = (Array.isArray(canvas?.child) ? canvas.child : [canvas?.child]).map(child => child?.['@_xsi:type']);

    expect(canvas?.['@_xsi:type']).toBe('canvas:CanvasModel');
    expect(childTypes).toEqual([
      'canvas:CanvasModelBlock',
      'canvas:CanvasModelImage',
      'canvas:CanvasModelSticky',
      'canvas:CanvasModelSticky',
    ]);
  });

  it('should default a missing connection xsi:type to Connection', () => {
    const connection = SourceConnectionMapper.schemaToSourceConnection({
      '@_id': 'c1',
      '@_source': 's1',
      '@_target': 't1',
    } as SchemaSourceConnection);

    expect(connection).toMatchObject({ id: 'c1', type: 'Connection', implicitType: true });
    expect(SourceConnectionMapper.toSchemaSourceConnection(connection)).not.toHaveProperty('@_xsi:type');
    expect(SourceConnectionMapper.toSchemaSourceConnection({ ...connection, type: 'DiagramModelReference' }))
      .toHaveProperty('@_xsi:type', 'archimate:DiagramModelReference');
  });

  it('should validate sketch and canvas views', async () => {
    const archimate = await parseFixture('test.archimate');
    const viewIds = ['ef92f44c-4a53-42d8-86f1-02b43da4f95b', '25d4e8d4-f410-4a1a-bc28-f184d66ea408'];

    expect(archimate.getElement(viewIds[0])?.type).toBe('SketchModel');
    expect(archimate.getElement(viewIds[1])?.type).toBe('CanvasModel');
    expect(archimate.validateModel().filter(issue => issue.path.startsWith('folder.diagrams'))).toEqual([]);
  });

  it('should declare the canvas namespace when a canvas view is added to a model without it', () => {
    const archimate = new Archimate();
    archimate.upsertElement({ name: 'Canvas', type: 'CanvasModel' });

    expect(archimate.serialize()['archimate:model']['@_xmlns:canvas']).toBe('http://www.archimatetool.com/archimate/canvas');
    expect(new Archimate().serialize()['archimate:model']).not.toHaveProperty('@_xmlns:canvas');
  });
});
