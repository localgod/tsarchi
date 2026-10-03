import { describe, expect, it } from 'vitest';
import { readFile } from 'fs/promises';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { Archimate } from '../src/Archimate.mjs';
import type { Schema } from '../src/interfaces/schema/Schema.mjs';

const fixture = 'tests/fixtures/roundtrip/model-content.archimate';

function parseXml(xml: string): Archimate {
  const raw = new XMLParser({ ignoreAttributes: false }).parse(xml) as Schema;
  const archimate = new Archimate();
  archimate.parse(raw);
  return archimate;
}

async function parseFile(path: string): Promise<Archimate> {
  return parseXml(await readFile(path, 'utf8'));
}

function modelWith(content: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="m" id="id-m" version="5.0.0">
  <folder name="Business" id="id-business" type="business">
    <element xsi:type="archimate:BusinessActor" name="Customer" id="id-customer"/>
  </folder>
  <folder name="Relations" id="id-relations" type="relations"/>
  ${content}
</archimate:model>`;
}

function modelKeys(archimate: Archimate): string[] {
  return Object.keys(archimate.serialize()['archimate:model']).filter(key => !key.startsWith('@_'));
}

describe('model-level content', () => {
  it('should load model properties, metadata and profiles', async () => {
    const archimate = await parseFile(fixture);

    expect(archimate.getProperties()).toEqual(
      new Map([
        ['Owner', 'Enterprise Architecture'],
        ['Status', 'Draft'],
      ])
    );
    expect(archimate.getMetadata()).toEqual(
      new Map([
        ['schema', 'Dublin Core'],
        ['creator', 'tsarchi'],
      ])
    );
    expect(archimate.getProfiles()).toEqual([
      {
        id: 'id-profile-premium',
        name: 'Premium',
        conceptType: 'BusinessActor',
        imagePath: 'images/premium.png',
        features: new Map([['profileFeature', 'kept']]),
      },
      { id: 'id-profile-contract', name: 'Contract', conceptType: 'AssignmentRelationship' },
      { id: 'id-profile-draft', name: 'Draft', conceptType: 'BusinessRole', specialization: false },
    ]);
    expect(archimate.getElement('id-customer')?.profiles).toBe('id-profile-premium');
    expect(archimate.getRelationship('id-rel-assignment')?.profiles).toBe('id-profile-contract');
  });

  it('should write model content set in code in the order Archi uses', () => {
    const archimate = parseXml(modelWith(''));
    archimate.setProfiles([{ id: 'id-profile', name: 'VIP', conceptType: 'BusinessActor' }]);
    archimate.setMetadata(new Map([['k', 'v']]));
    archimate.setPurpose('Why');
    archimate.setProperties(new Map([['p', '1']]));
    archimate.updateElement('id-customer', { profiles: 'id-profile' });

    const model = archimate.serialize()['archimate:model'];
    expect(modelKeys(archimate)).toEqual(['folder', 'property', 'purpose', 'metadata', 'profile']);
    expect(model.property).toEqual([{ '@_key': 'p', '@_value': '1' }]);
    expect(model.metadata).toEqual({ entry: [{ '@_key': 'k', '@_value': 'v' }] });
    expect(model.profile).toEqual([{ '@_name': 'VIP', '@_id': 'id-profile', '@_conceptType': 'BusinessActor' }]);
    expect(archimate.validateModel()).toEqual([]);
  });

  it('should remove model properties, metadata and profiles that are cleared', async () => {
    const archimate = await parseFile(fixture);
    archimate.setProperties(new Map());
    archimate.setMetadata(undefined);
    archimate.setProfiles(undefined);
    archimate.setPurpose(undefined);
    archimate.updateElement('id-customer', { profiles: '' });
    archimate.updateElement('id-rel-assignment', { profiles: '' });

    expect(modelKeys(archimate)).toEqual(['folder', 'feature']);
    expect(archimate.validateModel()).toEqual([]);
  });

  it('should keep an empty metadata element', () => {
    const archimate = parseXml(modelWith('<metadata/>'));

    expect(archimate.getMetadata().size).toBe(0);
    expect(new XMLBuilder({ ignoreAttributes: false, suppressEmptyNode: true }).build(archimate.serialize())).toContain('<metadata/>');
  });

  it('should keep attributes and child elements of the model it does not recognise', () => {
    const archimate = parseXml(
      modelWith(`<feature name="a" value="1"/>
  <feature name="b" value="2"/>
  <futureElement key="x"><nested>text</nested></futureElement>`).replace('version="5.0.0"', 'version="5.0.0" futureAttribute="kept"')
    );

    const model = archimate.serialize()['archimate:model'] as unknown as Record<string, unknown>;
    expect(model['@_futureAttribute']).toBe('kept');
    expect(model.feature).toEqual([
      { '@_name': 'a', '@_value': '1' },
      { '@_name': 'b', '@_value': '2' },
    ]);
    expect(model.futureElement).toEqual({ '@_key': 'x', nested: 'text' });
  });

  it('should report references to profiles that do not exist', async () => {
    const archimate = await parseFile(fixture);
    archimate.setProfiles(archimate.getProfiles().filter(profile => profile.id !== 'id-profile-premium'));

    expect(archimate.validateModel()).toEqual([expect.objectContaining({ code: 'element-missing-profile', id: 'id-customer' })]);
  });

  it('should treat profile ids as used ids', async () => {
    const archimate = await parseFile(fixture);

    expect(archimate.hasId('id-profile-draft')).toBe(true);
    archimate.setProfiles([...archimate.getProfiles(), { id: 'id-customer', name: 'Clash' }]);
    expect(archimate.validateModel()).toEqual([expect.objectContaining({ code: 'duplicate-id', id: 'id-customer' })]);
  });

  it('should keep the model properties Archi writes', async () => {
    const archimate = await parseFile('tests/fixtures/archi/Archisurance-xmlexchange.archimate');

    expect(archimate.getProperties()).toEqual(
      new Map([
        ['Property1', 'Value of Property 1'],
        ['Property2', 'Value of Property 2'],
      ])
    );
  });
});
