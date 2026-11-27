import { describe, expect, it } from 'vite-plus/test';
import { Archimate } from '../src/Archimate.mjs';
import type { Element as SchemaElement } from '../src/interfaces/schema/Element.mjs';
import type { Folder as SchemaFolder } from '../src/interfaces/schema/Folder.mjs';
import { archimateToSchema } from '../src/internal/SchemaAccess.mjs';
import { parseFile } from './helpers.mjs';

function schemaRelationships(archimate: Archimate): SchemaElement[] {
  const folders = archimateToSchema(archimate)['archimate:model'].folder as SchemaFolder | SchemaFolder[];
  const relations = (Array.isArray(folders) ? folders : [folders]).find(folder => folder['@_type'] === 'relations');
  const elements = relations?.element;
  return Array.isArray(elements) ? elements : elements ? [elements] : [];
}

describe('influence relationships', () => {
  it('should load the strength, leaving influences without one unset', async () => {
    const archimate = await parseFile('tests/fixtures/roundtrip/relationships-and-properties.archimate');

    const influence = archimate.getRelationship('id-influence-strength');
    expect(influence?.strength).toBe('++');
    expect(influence?.unrecognized).toBeUndefined();
    expect(archimate.getRelationship('id-influence')?.strength).toBeUndefined();
  });

  it('should save a strength set in code', () => {
    const archimate = new Archimate();
    archimate.upsertElement({ id: 'driver', name: 'Driver', type: 'Driver' });
    archimate.upsertElement({ id: 'goal', name: 'Goal', type: 'Goal' });
    archimate.upsertRelationship({
      id: 'strong',
      name: 's',
      type: 'InfluenceRelationship',
      source: 'goal',
      target: 'driver',
      strength: '+',
    });
    archimate.upsertRelationship({ id: 'plain', name: 'p', type: 'InfluenceRelationship', source: 'driver', target: 'goal' });

    expect(archimate.getRelationship('strong')?.strength).toBe('+');
    const relationships = schemaRelationships(archimate);
    expect(relationships.find(element => element['@_id'] === 'strong')?.['@_strength']).toBe('+');
    expect(relationships.find(element => element['@_id'] === 'plain')).not.toHaveProperty('@_strength');
  });
});
