import { describe, expect, it } from 'vitest';
import { readFile } from 'fs/promises';
import { XMLParser } from 'fast-xml-parser';
import { Archimate } from '../src/Archimate.mjs';
import type { Schema } from '../src/interfaces/schema/Schema.mjs';
import type { Child } from '../src/interfaces/Child.mjs';
import type { SourceConnection } from '../src/interfaces/SourceConnection.mjs';

const fixture = 'tests/fixtures/roundtrip/features-and-unrecognized.archimate';

async function parseFixture(): Promise<Archimate> {
  const raw = new XMLParser({ ignoreAttributes: false }).parse(await readFile(fixture, 'utf8')) as Schema;
  const archimate = new Archimate();
  archimate.parse(raw);
  return archimate;
}

function businessFolder(archimate: Archimate) {
  return archimate.serialize()['archimate:model'].folder.find(folder => folder['@_type'] === 'business')!;
}

describe('features on folders, elements and relationships', () => {
  it('should load features on elements, relationships and views', async () => {
    const archimate = await parseFixture();

    expect(archimate.getElement('id-customer')?.features).toEqual(new Map([['elementFeature', 'actor']]));
    expect(archimate.getElement('id-insurant')?.features).toEqual(new Map([['elementFeature', 'role']]));
    expect(archimate.getRelationship('id-assignment')?.features).toEqual(new Map([['relationshipFeature', 'assignment']]));
    expect(archimate.getView('id-view')?.features).toEqual(new Map([['viewFeature', 'view']]));
  });

  it('should load features on nested folders in file order', async () => {
    const archimate = await parseFixture();

    expect(archimate.getFolders('business')[0].features).toEqual(new Map([['folderFeature', 'nested'], ['secondFeature', '2']]));
  });

  it('should write features set in code', async () => {
    const archimate = await parseFixture();

    archimate.updateElement('id-insurant', { features: new Map([['elementFeature', 'changed'], ['added', 'yes']]) });

    const insurant = businessFolder(archimate).element as unknown as { '@_id': string; feature: unknown }[];
    expect(insurant.find(element => element['@_id'] === 'id-insurant')?.feature).toEqual([
      { '@_name': 'elementFeature', '@_value': 'changed' },
      { '@_name': 'added', '@_value': 'yes' },
    ]);
  });

  it('should keep features and unrecognised content when a view is changed through the view API', async () => {
    const archimate = await parseFixture();

    archimate.addGroup('id-view', 'Group', { x: 400, y: 12, width: 200, height: 100 });

    const view = archimate.getView('id-view');
    expect(view?.features).toEqual(new Map([['viewFeature', 'view']]));
    expect(view?.unrecognized).toEqual({ '@_futureViewAttribute': 'view' });
  });
});

describe('unrecognised content', () => {
  it('should keep unrecognised attributes and child elements of folders and elements', async () => {
    const archimate = await parseFixture();

    expect(archimate.getElement('id-customer')?.unrecognized).toEqual({
      '@_futureElementAttribute': 'actor',
      futureElement: { '@_key': 'value' },
    });
    expect(archimate.getRelationship('id-assignment')?.unrecognized).toEqual({
      '@_futureRelationshipAttribute': 'yes',
      futureRelationshipChild: '',
    });
    expect(archimate.getFolders('business')[0].unrecognized).toEqual({ '@_futureFolderAttribute': 'nested' });

    const folder = businessFolder(archimate) as unknown as Record<string, unknown>;
    expect(folder['@_futureFolderAttribute']).toBe('top');
    expect(folder.futureFolderChild).toBe('kept');
    expect(folder.feature).toEqual([{ '@_name': 'folderFeature', '@_value': 'top' }]);
  });

  it('should keep unrecognised content of diagram children and connections', async () => {
    const archimate = await parseFixture();

    const child = archimate.getView('id-view')?.children?.[0] as unknown as Child;
    expect(child.unrecognized).toEqual({
      '@_futureChildAttribute': 'child',
      futureChildElement: { '@_key': 'value' },
    });
    expect((child.sourceConnection as SourceConnection).unrecognized).toEqual({
      '@_futureConnectionAttribute': 'connection',
      futureConnectionChild: { '@_key': 'value' },
    });
  });

  it('should not treat mapped content as unrecognised', async () => {
    const archimate = await parseFixture();

    expect(archimate.getElement('id-insurant')?.unrecognized).toBeUndefined();
    const insurantObject = archimate.getView('id-view')?.children?.[1] as unknown as Child;
    expect(insurantObject.unrecognized).toBeUndefined();
  });
});
