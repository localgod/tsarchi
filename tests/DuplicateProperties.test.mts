import { describe, expect, it } from 'vite-plus/test';
import { readFile } from 'fs/promises';
import { Archimate } from '../src/Archimate.mjs';
import { addProperty, getProperty, removeProperty, setProperty } from '../src/Properties.mjs';

const fixture = 'tests/fixtures/roundtrip/duplicate-property-keys.archimate';

async function load(): Promise<Archimate> {
  return Archimate.fromXml(await readFile(fixture, 'utf8'));
}

function propertyLines(xml: string, from: string, to: string): string[] {
  const start = xml.indexOf(from);
  return xml.slice(start, xml.indexOf(to, start)).match(/<property\b[^>]*\/>/g) ?? [];
}

describe('duplicate property keys', () => {
  it('keeps every property in file order, repeated keys and missing values included', async () => {
    const customer = (await load()).getElement('id-dup-customer')!;

    expect(customer.properties).toEqual([
      { key: 'tag', value: 'one' },
      { key: 'owner', value: 'sales' },
      { key: 'tag', value: 'two' },
      { key: 'tag' },
    ]);
  });

  it('keeps repeated keys on the model, folders, relationships, views, diagram objects and view connections', async () => {
    const model = await load();
    const values = (properties: { value?: string }[] | undefined) => properties?.map(property => property.value);

    expect(values(model.getProperties())).toEqual(['Enterprise Architecture', 'Draft', 'Security']);
    expect(values(model.getFolder('business').properties)).toEqual(['2026-01', '2026-06']);
    expect(values(model.getFolderById('id-dup-customers')!.properties)).toEqual(['sales', 'marketing']);
    expect(values(model.getRelationship('id-dup-assignment')!.properties)).toEqual(['interview', 'survey']);
    const view = model.getView('id-dup-view')!;
    expect(values(view.properties)).toEqual(['board', 'team']);
    expect(values(view.children[0].properties)).toEqual(['front', 'back']);
    expect(values(view.children[0].sourceConnections[0].properties)).toEqual(['a', 'b']);
  });

  it('returns copies of the properties', async () => {
    const model = await load();
    const before = model.toXml();
    model.getElement('id-dup-customer')!.properties![0].value = 'changed';
    model.getView('id-dup-view')!.properties![0].value = 'changed';
    model.getView('id-dup-view')!.children[0].properties![0].value = 'changed';
    model.getProperties()[0].value = 'changed';
    model.getFolderById('id-dup-customers')!.properties![0].value = 'changed';

    expect(model.toXml()).toBe(before);
  });

  it('writes a list changed with the helpers through updateElement', async () => {
    const model = await load();
    let properties = model.getElement('id-dup-customer')!.properties;
    properties = setProperty(properties, 'owner', 'support');
    properties = addProperty(properties, 'tag', 'three');
    properties = removeProperty(properties, 'tag', 'one');
    model.updateElement('id-dup-customer', { properties });

    expect(propertyLines(model.toXml(), 'id="id-dup-customer"', '</element>')).toEqual([
      '<property key="owner" value="support"/>',
      '<property key="tag" value="two"/>',
      '<property key="tag"/>',
      '<property key="tag" value="three"/>',
    ]);
  });

  it('sets repeated keys on new elements, relationships, folders and the model', async () => {
    const model = await load();
    const list = [
      { key: 'k', value: '1' },
      { key: 'k', value: '2' },
    ];
    const actor = model.upsertElement({ name: 'New', type: 'BusinessActor', properties: list });
    const relationship = model.upsertRelationship({
      type: 'AssociationRelationship',
      source: actor.id,
      target: 'id-dup-buyer',
      properties: list,
    });
    const folder = model.createFolder('id-dup-customers', { name: 'Sub', properties: list });
    model.setProperties(list);
    list[0].value = 'changed afterwards';

    const reloaded = Archimate.fromXml(model.toXml());
    const expected = [
      { key: 'k', value: '1' },
      { key: 'k', value: '2' },
    ];
    expect(reloaded.getElement(actor.id)!.properties).toEqual(expected);
    expect(reloaded.getRelationship(relationship.id)!.properties).toEqual(expected);
    expect(reloaded.getFolderById(folder.id)!.properties).toEqual(expected);
    expect(reloaded.getProperties()).toEqual(expected);
    expect(getProperty(reloaded.getProperties(), 'k')).toBe('1');
  });

  it('removes the properties when an empty list is given', async () => {
    const model = await load();
    model.setProperties([]);
    model.updateFolderById('id-dup-customers', { properties: [] });

    expect(model.getProperties()).toEqual([]);
    expect(model.getFolderById('id-dup-customers')!.properties).toBeUndefined();
    expect(model.toXml()).not.toContain('key="Owner"');
  });

  it('keeps repeated keys through a snapshot', async () => {
    const model = await load();
    const copy = Archimate.fromSnapshot(JSON.parse(JSON.stringify(model.snapshot())));

    expect(copy.toXml()).toBe(model.toXml());
    expect(copy.getElement('id-dup-customer')!.properties).toEqual(model.getElement('id-dup-customer')!.properties);
  });
});
