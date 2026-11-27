import { describe, expect, it } from 'vite-plus/test';
import { XMLBuilder } from 'fast-xml-parser';
import { Archimate } from '../src/Archimate.mjs';
import { archimateToSchema } from '../src/internal/SchemaAccess.mjs';
import { modelXml, parseFile, parseXml } from './helpers.mjs';

const fixture = 'tests/fixtures/roundtrip/model-content.archimate';

function modelWith(content: string): string {
  return modelXml(`  <folder name="Business" id="id-business" type="business">
    <element xsi:type="archimate:BusinessActor" name="Customer" id="id-customer"/>
  </folder>
  <folder name="Relations" id="id-relations" type="relations"/>
  ${content}`);
}

function modelKeys(archimate: Archimate): string[] {
  return Object.keys(archimateToSchema(archimate)['archimate:model']).filter(key => !key.startsWith('@_'));
}

describe('model-level content', () => {
  it('should load model properties, metadata and profiles', async () => {
    const archimate = await parseFile(fixture);

    expect(archimate.getProperties()).toEqual([
      { key: 'Owner', value: 'Enterprise Architecture' },
      { key: 'Status', value: 'Draft' },
    ]);
    expect(archimate.getMetadata()).toEqual([
      { key: 'schema', value: 'Dublin Core' },
      { key: 'creator', value: 'tsarchi' },
    ]);
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
    expect(archimate.getElement('id-customer')?.profiles).toEqual(['id-profile-premium']);
    expect(archimate.getRelationship('id-rel-assignment')?.profiles).toEqual(['id-profile-contract']);
  });

  it('should write model content set in code in the order Archi uses', () => {
    const archimate = parseXml(modelWith(''));
    archimate.setProfiles([{ id: 'id-profile', name: 'VIP', conceptType: 'BusinessActor' }]);
    archimate.setMetadata([{ key: 'k', value: 'v' }]);
    archimate.setPurpose('Why');
    archimate.setProperties([{ key: 'p', value: '1' }]);
    archimate.updateElement('id-customer', { profiles: ['id-profile'] });

    const model = archimateToSchema(archimate)['archimate:model'];
    expect(modelKeys(archimate)).toEqual(['folder', 'property', 'purpose', 'metadata', 'profile']);
    expect(model.property).toEqual([{ '@_key': 'p', '@_value': '1' }]);
    expect(model.metadata).toEqual({ entry: [{ '@_key': 'k', '@_value': 'v' }] });
    expect(model.profile).toEqual([{ '@_name': 'VIP', '@_id': 'id-profile', '@_conceptType': 'BusinessActor' }]);
    expect(archimate.validateModel()).toEqual([]);
  });

  it('should remove model properties, metadata and profiles that are cleared', async () => {
    const archimate = await parseFile(fixture);
    archimate.setProperties([]);
    archimate.setMetadata(undefined);
    archimate.setProfiles(undefined);
    archimate.setPurpose(undefined);
    archimate.updateElement('id-customer', { profiles: [] });
    archimate.updateElement('id-rel-assignment', { profiles: [] });

    expect(modelKeys(archimate)).toEqual(['folder', 'feature']);
    expect(archimate.validateModel()).toEqual([]);
  });

  it('should keep an empty metadata element', () => {
    const archimate = parseXml(modelWith('<metadata/>'));

    expect(archimate.getMetadata()).toEqual([]);
    expect(new XMLBuilder({ ignoreAttributes: false, suppressEmptyNode: true }).build(archimateToSchema(archimate))).toContain(
      '<metadata/>'
    );
  });

  it('should keep attributes and child elements of the model it does not recognise', () => {
    const archimate = parseXml(
      modelWith(`<feature name="a" value="1"/>
  <feature name="b" value="2"/>
  <futureElement key="x"><nested>text</nested></futureElement>`).replace('version="5.0.0"', 'version="5.0.0" futureAttribute="kept"')
    );

    const model = archimateToSchema(archimate)['archimate:model'] as unknown as Record<string, unknown>;
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

    expect(archimate.getProperties()).toEqual([
      { key: 'Property1', value: 'Value of Property 1' },
      { key: 'Property2', value: 'Value of Property 2' },
    ]);
  });
});
