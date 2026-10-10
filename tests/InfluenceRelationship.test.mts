import { describe, expect, it } from 'vitest';
import { readFile } from 'fs/promises';
import { XMLParser } from 'fast-xml-parser';
import { Archimate } from '../src/Archimate.mjs';
import type { Schema } from '../src/interfaces/schema/Schema.mjs';
import type { Element as SchemaElement } from '../src/interfaces/schema/Element.mjs';
import type { Folder as SchemaFolder } from '../src/interfaces/schema/Folder.mjs';
import { archimateFromSchema, archimateToSchema } from '../src/internal/SchemaAccess.mjs';

async function parseFile(path: string): Promise<Archimate> {
  const xml = await readFile(path, 'utf8');
  const raw = new XMLParser({ ignoreAttributes: false }).parse(xml) as Schema;
  const archimate = archimateFromSchema(raw);
  return archimate;
}

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
