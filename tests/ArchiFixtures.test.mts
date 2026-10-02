import { describe, expect, it } from 'vitest';
import { readFile } from 'fs/promises';
import { XMLParser } from 'fast-xml-parser';
import { Archimate } from '../src/Archimate.mjs';
import type { Schema } from '../src/interfaces/schema/Schema.mjs';
import type { SourceConnection as SchemaSourceConnection } from '../src/interfaces/schema/SourceConnection.mjs';
import { SourceConnectionMapper } from '../src/internal/SourceConnectionMapper.mjs';
import type { Child } from '../src/interfaces/Child.mjs';

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

function findChild(archimate: Archimate, viewId: string, id: string): Child | undefined {
  const search = (children: Child | Child[] | undefined): Child | undefined => {
    for (const child of Array.isArray(children) ? children : children ? [children] : []) {
      const found = child.id === id ? child : search(child.child);
      if (found) return found;
    }
    return undefined;
  };
  return search(archimate.getElement(viewId)?.child);
}

// testDeleteHandler has two relationships Archi's matrix rejects; they are warnings, not errors.
function errors(archimate: Archimate) {
  return archimate.validateModel().filter(issue => issue.severity === 'error');
}

describe('Archi-produced models', () => {
  it('should report relationships Archi\'s matrix rejects as warnings', async () => {
    const archimate = await parseFixture('testDeleteHandler.archimate');

    expect(archimate.validateModel()).toEqual([
      expect.objectContaining({ code: 'relationship-type-not-allowed', severity: 'warning', id: 'd934bb5f' }),
      expect.objectContaining({ code: 'relationship-type-not-allowed', severity: 'warning', id: 'ff805459' }),
    ]);
    expect(() => archimate.assertValidModel()).not.toThrow();
  });

  it.each(['Archisurance.archimate', 'Archisurance-xmlexchange.archimate', 'modelimporter-test.archimate', 'test.archimate', 'testCopySnapshot.archimate'])(
    'should find no relationship Archi\'s matrix rejects in %s',
    async (name) => {
      const archimate = await parseFixture(name);
      expect(archimate.validateModel()).toEqual([]);
    }
  );

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

  it('should keep connections nested in connections', async () => {
    const archimate = await parseFixture('testCopySnapshot.archimate');
    const codes = archimate.validateModel().map(issue => issue.code);
    const connections = collectSourceConnections(archimate.serialize());

    expect(codes).not.toContain('view-connection-missing-source');
    expect(codes).not.toContain('view-connection-missing-target');
    expect(codes).not.toContain('view-target-connection-missing-source');
    expect(connections.map(connection => connection['@_id'])).toEqual(expect.arrayContaining(['49ca207a', '095aa391']));
    expect(connections.find(connection => connection['@_id'] === '9f83beb6')?.['@_targetConnections']).toBe('70635c80');
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

  it('should load alternate figures, view references and access types', async () => {
    const archimate = await parseFixture('Archisurance.archimate');

    expect(findChild(archimate, '3761', '3786')?.figure).toBe(1);
    expect(findChild(archimate, '3641', '3657')?.model).toBe('3944');
    expect(archimate.getRelationship('695')?.accessType).toBe(1);
  });

  it('should expose the model name, id and version', async () => {
    const archimate = await parseFixture('Archisurance.archimate');
    expect(archimate.getName()).toBe('Archisurance');
    expect(archimate.getId()).toBe('11f5304f');
    expect(archimate.getVersion()).toBe('5.0.0');

    archimate.setName('Renamed');
    expect(archimate.getName()).toBe('Renamed');
    expect(archimate.serialize()['archimate:model']['@_name']).toBe('Renamed');
  });

  it('should list all elements and relationships', async () => {
    const archimate = await parseFixture('Archisurance.archimate');
    const elements = archimate.listElements();
    const relationships = archimate.listRelationships();

    expect(elements).toHaveLength(120);
    expect(elements.every(element => !element.type.endsWith('Relationship') && !element.type.endsWith('Model'))).toBe(true);
    expect(relationships).toHaveLength(176);
    expect(relationships.every(relationship => relationship.type.endsWith('Relationship'))).toBe(true);
  });

  it('should load and save the model purpose', async () => {
    const archimate = await parseFixture('testDeleteHandler.archimate');
    expect(archimate.getPurpose()).toBe('A variety of testing scenarios');

    archimate.setPurpose('Changed');
    expect(archimate.serialize()['archimate:model'].purpose).toBe('Changed');

    archimate.setPurpose(undefined);
    expect(archimate.serialize()['archimate:model']).not.toHaveProperty('purpose');
  });

  it('should remove diagram model references when deleting the referenced view', async () => {
    const archimate = await parseFixture('testDeleteHandler.archimate');
    expect(findChild(archimate, '17cdf396', '99a52921')?.model).toBe('12917bec');

    expect(archimate.deleteView('12917bec')).toBe(true);

    expect(errors(archimate)).toEqual([]);
    expect(findChild(archimate, '17cdf396', '99a52921')).toBeUndefined();
  });

  it('should remove diagram objects nested in other diagram objects when deleting their element', async () => {
    for (const [elementId, objectId] of [['8ab84e91', 'c9fc8676'], ['8ecabfc2', '9fb7222b']]) {
      const archimate = await parseFixture('testDeleteHandler.archimate');
      expect(findChild(archimate, '12917bec', objectId)).toBeDefined();

      expect(archimate.deleteElement(elementId)).toBe(true);

      expect(errors(archimate)).toEqual([]);
      expect(findChild(archimate, '12917bec', objectId)).toBeUndefined();
    }
  });

  it('should load style features written by Archi into typed properties', async () => {
    const archimate = await parseFixture('Archisurance-xmlexchange.archimate');
    const viewId = '9e9cb71c-3504-4de0-beee-0a0f3c27fdaf';

    expect(findChild(archimate, viewId, '1f1e1d12-f53a-4be5-bf16-07103923aa77')?.lineStyle).toBe(2);
    expect(findChild(archimate, viewId, 'e5a21845-8bbe-4cdb-a3f1-b75fe7b6eb2f')?.deriveElementLineColor).toBe(false);
  });

  it('should load connection features written by Archi into typed properties', async () => {
    const archimate = await parseFixture('modelimporter-test.archimate');
    const connection = findChild(archimate, 'c6443ba3-18a6-4695-94ec-0e6845d0f42f', '6182a68e-5c80-48ac-9486-9fdf53f793c0')?.sourceConnection;

    expect(Array.isArray(connection) ? connection[0] : connection).toMatchObject({ nameVisible: false });
  });
});
