import { describe, expect, it } from 'vite-plus/test';
import { readFile, readdir } from 'fs/promises';
import { Archimate } from '../src/Archimate.mjs';
import { archimateToSchema } from '../src/internal/SchemaAccess.mjs';

async function load(path: string): Promise<Archimate> {
  return Archimate.fromXml(await readFile(path, 'utf8'));
}

/**
 * Every object in the serialized model that has an `@_id`, keyed by id.
 */
function collectById(node: unknown, found = new Map<string, Record<string, unknown>>()): Map<string, Record<string, unknown>> {
  if (Array.isArray(node)) {
    node.forEach(item => collectById(item, found));
  } else if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (typeof record['@_id'] === 'string') found.set(record['@_id'], record);
    Object.values(record).forEach(value => collectById(value, found));
  }
  return found;
}

/**
 * Every `@_id` in the serialized model, duplicates included.
 */
function allIds(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    node.forEach(item => allIds(item, found));
  } else if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (typeof record['@_id'] === 'string') found.push(record['@_id']);
    Object.values(record).forEach(value => allIds(value, found));
  }
  return found;
}

const idKeys = new Set(['@_id', '@_source', '@_target', '@_model']);

/**
 * Expects the copy to be the original with its ids replaced one for one, other than the name. Ids not in the copy
 * (elements, relationships, other views) must be the same.
 */
function expectSameUpToIds(original: unknown, copy: unknown, ids: Map<string, string>, path = 'view'): void {
  if (
    typeof original === 'string' &&
    typeof copy === 'string' &&
    (idKeys.has(path.split('.').at(-1)!) || path.endsWith('@_targetConnections'))
  ) {
    const originalIds = original.split(' ');
    const copyIds = copy.split(' ');
    expect(copyIds.length, path).toBe(originalIds.length);
    originalIds.forEach((id, index) => {
      if (!ids.has(id)) ids.set(id, copyIds[index]);
      expect(copyIds[index], path).toBe(ids.get(id));
    });
    return;
  }
  if (original && typeof original === 'object' && copy && typeof copy === 'object') {
    expect(Object.keys(copy), path).toEqual(Object.keys(original));
    expect(Array.isArray(copy), path).toBe(Array.isArray(original));
    for (const [key, value] of Object.entries(original)) {
      if (path === 'view' && key === '@_name') continue;
      expectSameUpToIds(value, (copy as Record<string, unknown>)[key], ids, `${path}.${key}`);
    }
    return;
  }
  expect(copy, path).toEqual(original);
}

const roundtripFixtures = 'tests/fixtures/roundtrip';

describe('duplicateView', () => {
  it('should copy every view of every round-trip fixture with new ids and nothing else changed', async () => {
    const files = (await readdir(roundtripFixtures)).filter(file => file.endsWith('.archimate'));
    let copied = 0;
    for (const file of files) {
      const archimate = await load(`${roundtripFixtures}/${file}`);
      const originalIds = new Set(allIds(archimateToSchema(archimate)));

      for (const view of archimate.listViews()) {
        const copy = archimate.duplicateView(view.id)!;
        copied++;

        expect(copy.name, file).toBe(`${view.name} (copy)`);
        const saved = archimateToSchema(archimate);
        const byId = collectById(saved);
        const ids = new Map([[view.id, copy.id]]);
        expectSameUpToIds(byId.get(view.id), byId.get(copy.id), ids, 'view');
        // Every id in the copy is new; ids it shares with the original are references to the model.
        for (const [originalId, copyId] of ids) {
          if (originalId === copyId)
            expect(byId.has(originalId) && !collectById(byId.get(view.id)).has(originalId), `${file} ${originalId}`).toBe(true);
          else expect(originalIds.has(copyId), `${file} ${copyId}`).toBe(false);
        }
        const savedIds = allIds(saved);
        expect(new Set(savedIds).size, file).toBe(savedIds.length);
      }
      expect(archimate.validateModel(), file).toEqual([]);
    }
    expect(copied).toBeGreaterThanOrEqual(20);
  });

  it('should keep the copy after saving and loading', async () => {
    const archimate = await load(`${roundtripFixtures}/connection-to-connection.archimate`);

    const copy = archimate.duplicateView('id-c2c-view', { name: 'Variant' })!;

    const reloaded = Archimate.fromXml(archimate.toXml());
    expect(reloaded.getView(copy.id)).toEqual(copy);
    expect(copy.name).toBe('Variant');
    expect(reloaded.listViews().map(view => view.name)).toEqual(['Connection View', 'Variant']);
  });

  it('should refer to the same elements and relationships, without copying them', async () => {
    const archimate = await load(`${roundtripFixtures}/connection-to-connection.archimate`);
    const elements = archimate.listElements().length;
    const relationships = archimate.listRelationships().length;

    const copy = archimate.duplicateView('id-c2c-view')!;

    expect(archimate.listElements()).toHaveLength(elements);
    expect(archimate.listRelationships()).toHaveLength(relationships);
    expect(copy.children.map(child => child.archimateElement)).toEqual(['id-clerk', 'id-cashier', 'id-contract']);
    expect(copy.children[0].sourceConnections[0].archimateRelationship).toBe('id-assignment');
  });

  it('should leave the original unchanged when the copy is edited', async () => {
    const archimate = await load(`${roundtripFixtures}/nested-diagram-objects.archimate`);
    const original = archimate.getView('id-nested-view');

    const copy = archimate.duplicateView('id-nested-view')!;
    const portal = copy.children.find(child => child.archimateElement === 'id-portal')!;
    archimate.updateDiagramObjectStyle(copy.id, portal.children[0].id, { fillColor: '#ff0000' });
    archimate.removeDiagramObject(copy.id, portal.id);

    expect(archimate.getView('id-nested-view')).toEqual(original);
    expect(archimate.getView(copy.id)!.children).toHaveLength(original!.children.length - 1);
  });

  it('should add the copy at the end of the original view’s nested folder', async () => {
    const archimate = await load(`${roundtripFixtures}/nested-folders.archimate`);

    const copy = archimate.duplicateView('id-portal-view')!;

    const folderElements = (archimate: Archimate) => {
      const folder = collectById(archimateToSchema(archimate)).get('id-folder-overviews')!;
      return ([] as Record<string, unknown>[]).concat(folder.element as Record<string, unknown>).map(element => element['@_id']);
    };
    expect(folderElements(archimate)).toEqual(['id-portal-view', copy.id]);
    expect(folderElements(Archimate.fromXml(archimate.toXml()))).toEqual(['id-portal-view', copy.id]);
  });

  it('should add the copy at the end of the top-level folder', async () => {
    const archimate = await load(`${roundtripFixtures}/view-references.archimate`);

    const copy = archimate.duplicateView('id-overview')!;

    expect(archimate.listViews().at(-1)?.id).toBe(copy.id);
    expect(Archimate.fromXml(archimate.toXml()).listViews().at(-1)?.id).toBe(copy.id);
  });

  it('should point a reference to the view itself at the copy, and keep references to other views', async () => {
    const archimate = await load(`${roundtripFixtures}/view-references.archimate`);
    const xml = archimate.toXml().replace('model="id-other"', 'model="id-overview"');
    const withSelfReference = Archimate.fromXml(xml);

    const copy = withSelfReference.duplicateView('id-overview')!;

    const saved = collectById(archimateToSchema(withSelfReference));
    const references = [...collectById(saved.get(copy.id)).values()].filter(
      node => node['@_xsi:type'] === 'archimate:DiagramModelReference'
    );
    expect(references.map(node => node['@_model'])).toEqual(['id-detail', copy.id, 'id-detail']);
    expect(saved.get('id-ref-other-view')?.['@_model']).toBe('id-overview');
    expect(withSelfReference.validateModel()).toEqual([]);
  });

  it('should give new ids to unrecognized content and rewrite references to copied objects in it', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="future" id="id-model" version="5.0.0">
  <folder name="Business" id="id-business" type="business">
    <element xsi:type="archimate:BusinessActor" name="Actor" id="id-actor"/>
  </folder>
  <folder name="Views" id="id-views" type="diagrams">
    <element xsi:type="archimate:ArchimateDiagramModel" name="View" id="id-view">
      <child xsi:type="archimate:DiagramObject" id="id-object" archimateElement="id-actor">
        <bounds x="0" y="0" width="120" height="55"/>
        <futureLink id="id-future" source="id-object" target="id-actor" targetConnections="id-object id-elsewhere"/>
      </child>
    </element>
  </folder>
</archimate:model>`;
    const archimate = Archimate.fromXml(xml);

    const copy = archimate.duplicateView('id-view')!;

    const saved = collectById(archimateToSchema(archimate));
    const copiedObject = copy.children[0];
    const futureLinks = [...saved.values()].filter(node => node['@_source'] === copiedObject.id);
    expect(futureLinks).toHaveLength(1);
    expect(futureLinks[0]['@_id']).not.toBe('id-future');
    expect(futureLinks[0]['@_target']).toBe('id-actor');
    expect(futureLinks[0]['@_targetConnections']).toBe(`${copiedObject.id} id-elsewhere`);
    expect(saved.get('id-future')?.['@_source']).toBe('id-object');
    const savedIds = allIds(archimateToSchema(archimate));
    expect(new Set(savedIds).size).toBe(savedIds.length);
  });

  it('should register the copy’s ids, so new ids do not reuse them', async () => {
    const archimate = await load(`${roundtripFixtures}/connection-to-connection.archimate`);

    const copy = archimate.duplicateView('id-c2c-view')!;

    expect(archimate.hasId(copy.id)).toBe(true);
    expect(archimate.hasId(copy.children[0].id)).toBe(true);
    expect(archimate.hasId(copy.children[0].sourceConnections[0].sourceConnections[0].id)).toBe(true);
  });

  it('should return null when there is no view with that id', async () => {
    const archimate = await load(`${roundtripFixtures}/connection-to-connection.archimate`);
    const before = archimate.toXml();

    expect(archimate.duplicateView('id-missing')).toBeNull();
    expect(archimate.duplicateView('id-clerk')).toBeNull();
    expect(archimate.duplicateView('id-assignment')).toBeNull();
    expect(archimate.toXml()).toBe(before);
  });
});
