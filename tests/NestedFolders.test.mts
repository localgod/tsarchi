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

describe('nested folder details', () => {
  const file = 'tests/fixtures/roundtrip/nested-folders.archimate';

  it('should return the details of a nested folder at any depth', async () => {
    const archimate = await parseFile(file);

    expect(archimate.getFolderById('id-folder-portals')).toEqual({
      id: 'id-folder-portals',
      name: 'Portals',
      documentation: 'Customer-facing systems.',
      properties: new Map([['owner', 'digital']]),
    });
    expect(archimate.getFolderById('id-folder-legacy')).toEqual({ id: 'id-folder-legacy', name: 'Legacy' });
    expect(archimate.getFolderById('id-folder-overviews')).toEqual({ id: 'id-folder-overviews', name: 'Overviews' });
  });

  it('should return the details of a top-level folder by id', async () => {
    const archimate = await parseFile(file);

    expect(archimate.getFolderById('id-nested-application')).toEqual(archimate.getFolder('application'));
  });

  it('should return null for an unknown folder id', async () => {
    const archimate = await parseFile(file);

    expect(archimate.getFolderById('id-portal')).toBeNull();
    expect(archimate.getFolderById('id-missing')).toBeNull();
  });

  it('should return copies of the folder maps', async () => {
    const archimate = await parseFile(file);

    archimate.getFolderById('id-folder-portals')?.properties?.set('changed', 'no');

    expect(archimate.getFolderById('id-folder-portals')?.properties).toEqual(new Map([['owner', 'digital']]));
  });

  it('should write nested folder details set in code and keep its contents', async () => {
    const archimate = await parseFile(file);

    const details = archimate.updateFolderById('id-folder-legacy', {
      name: 'Retired',
      documentation: 'No longer used.',
      properties: new Map([['owner', 'ops']]),
      features: new Map([['folderFeature', 'yes']]),
    });

    expect(details).toEqual(archimate.getFolderById('id-folder-legacy'));
    const legacy = findSchemaFolder(archimate.serialize()['archimate:model'].folder, 'id-folder-legacy') as unknown as Record<string, unknown>;
    expect(legacy['@_name']).toBe('Retired');
    expect(legacy.documentation).toBe('No longer used.');
    expect(legacy.property).toEqual([{ '@_key': 'owner', '@_value': 'ops' }]);
    expect(legacy.feature).toEqual([{ '@_name': 'folderFeature', '@_value': 'yes' }]);
    expect(elementIds(legacy as SchemaFolder)).toEqual(['id-old-portal']);
    expect(archimate.validateModel()).toEqual([]);
  });

  it('should remove nested folder details that are cleared and leave the others unchanged', async () => {
    const archimate = await parseFile(file);

    archimate.updateFolderById('id-folder-portals', { documentation: undefined, properties: new Map() });

    expect(archimate.getFolderById('id-folder-portals')).toEqual({ id: 'id-folder-portals', name: 'Portals' });
    const portals = findSchemaFolder(archimate.serialize()['archimate:model'].folder, 'id-folder-portals') as unknown as Record<string, unknown>;
    expect(portals.documentation).toBeUndefined();
    expect(portals.property).toBeUndefined();
    expect(elementIds(portals as SchemaFolder)).toEqual(['id-portal', 'id-portal-service']);
  });

  it('should update a top-level folder by id', async () => {
    const archimate = await parseFile(file);

    archimate.updateFolderById('id-nested-application', { documentation: '' });

    expect(archimate.getFolder('application')).toEqual({ id: 'id-nested-application', name: 'Application' });
  });

  it('should reject an unknown folder id and an empty folder name', async () => {
    const archimate = await parseFile(file);

    expect(() => archimate.updateFolderById('id-missing', { name: 'x' })).toThrow('Folder "id-missing" not found in model.');
    expect(() => archimate.updateFolderById('id-folder-legacy', { name: '' })).toThrow('A folder name cannot be empty.');
  });
});
