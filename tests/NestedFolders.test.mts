import { describe, expect, it } from 'vitest';
import { readFile } from 'fs/promises';
import { XMLParser } from 'fast-xml-parser';
import { Archimate } from '../src/Archimate.mjs';
import type { Schema } from '../src/interfaces/schema/Schema.mjs';
import type { Folder as SchemaFolder } from '../src/interfaces/schema/Folder.mjs';

async function parseFile(path: string): Promise<Archimate> {
  const xml = await readFile(path, 'utf8');
  const raw = new XMLParser({ ignoreAttributes: false }).parse(xml) as Schema;
  const archimate = new Archimate();
  archimate.parse(raw);
  return archimate;
}

function findSchemaFolder(folders: SchemaFolder | SchemaFolder[] | undefined, id: string): SchemaFolder | undefined {
  for (const folder of Array.isArray(folders) ? folders : folders ? [folders] : []) {
    if (folder['@_id'] === id) return folder;
    const nested = findSchemaFolder(folder.folder, id);
    if (nested) return nested;
  }
  return undefined;
}

function elementIds(folder: SchemaFolder | undefined): string[] {
  const elements = folder?.element;
  return (Array.isArray(elements) ? elements : elements ? [elements] : []).map(element => element['@_id']);
}

describe('nested folders', () => {
  it('should load elements from nested folders (Archi testDeleteHandler model)', async () => {
    const archimate = await parseFile('tests/fixtures/archi/testDeleteHandler.archimate');

    expect(archimate.findElementsByFolder('application').map(element => element.id))
      .toEqual(['e836c6be', 'd1247cf1', 'b5742e18']);
    expect(archimate.validateModel().filter(issue =>
      ['relationship-missing-source', 'relationship-missing-target', 'diagram-object-missing-element'].includes(issue.code)
    )).toEqual([]);
  });

  it('should expose the folder tree with metadata', async () => {
    const archimate = await parseFile('tests/fixtures/roundtrip/nested-folders.archimate');

    const [portals, empty] = archimate.getFolders('application');
    expect(portals).toMatchObject({
      id: 'id-folder-portals',
      name: 'Portals',
      documentation: 'Customer-facing systems.',
      elementIds: ['id-portal', 'id-portal-service'],
      folders: [{ id: 'id-folder-legacy', name: 'Legacy', elementIds: ['id-old-portal'] }],
    });
    expect(portals.properties).toEqual(new Map([['owner', 'digital']]));
    expect(empty).toEqual({ id: 'id-folder-empty', name: 'Empty' });
    expect(archimate.getFolders('strategy')).toEqual([]);
    expect(archimate.listViews().map(view => view.id)).toEqual(['id-portal-view']);
  });

  it('should treat nested folder ids as used', async () => {
    const archimate = await parseFile('tests/fixtures/roundtrip/nested-folders.archimate');

    expect(archimate.hasId('id-folder-legacy')).toBe(true);
  });

  it('should report duplicate nested folder ids', async () => {
    const archimate = await parseFile('tests/fixtures/roundtrip/nested-folders.archimate');
    archimate.getFolders('application')[1].id = 'id-folder-legacy';

    expect(archimate.validateModel()).toEqual([
      expect.objectContaining({ code: 'duplicate-id', id: 'id-folder-legacy', path: 'folder.application.folders[1]' }),
    ]);
  });

  it('should drop deleted elements from their nested folder', async () => {
    const archimate = await parseFile('tests/fixtures/roundtrip/nested-folders.archimate');

    archimate.deleteElement('id-old-portal');

    expect(archimate.getFolders('application')[0].folders?.[0].elementIds).toEqual([]);
    const legacy = findSchemaFolder(archimate.serialize()['archimate:model'].folder, 'id-folder-legacy');
    expect(legacy).toBeDefined();
    expect(elementIds(legacy)).toEqual([]);
  });

  it('should keep elements in their nested folder when updated in place', async () => {
    const archimate = await parseFile('tests/fixtures/roundtrip/nested-folders.archimate');

    archimate.updateElement('id-portal', { name: 'Renamed Portal' });

    const portals = findSchemaFolder(archimate.serialize()['archimate:model'].folder, 'id-folder-portals');
    expect(elementIds(portals)).toEqual(['id-portal', 'id-portal-service']);
  });

  it('should move an element to the top of its new folder when its type changes folder', async () => {
    const archimate = await parseFile('tests/fixtures/roundtrip/nested-folders.archimate');

    archimate.updateElement('id-portal', { type: 'Node' });

    expect(archimate.getFolders('application')[0].elementIds).toEqual(['id-portal-service']);
    const folders = archimate.serialize()['archimate:model'].folder;
    expect(elementIds(folders.find(folder => folder['@_type'] === 'technology'))).toEqual(['id-portal']);
  });

  it('should place new elements at the top level of their folder', async () => {
    const archimate = await parseFile('tests/fixtures/roundtrip/nested-folders.archimate');

    archimate.upsertElement({ id: 'id-new', name: 'New App', type: 'ApplicationComponent' });

    const folders = archimate.serialize()['archimate:model'].folder;
    expect(elementIds(folders.find(folder => folder['@_type'] === 'application'))).toEqual(['id-crm', 'id-new']);
  });
});
