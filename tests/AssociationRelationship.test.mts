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

describe('association relationships', () => {
  it('should load directed, leaving undirected associations without it', async () => {
    const archimate = await parseFile('tests/fixtures/roundtrip/relationships-and-properties.archimate');

    const directed = archimate.getRelationship('id-association-directed');
    expect(directed?.directed).toBe(true);
    expect(directed?.unrecognized).toBeUndefined();
    expect(archimate.getRelationship('id-association')?.directed).toBeUndefined();
  });

  it('should save a directed association created in code', () => {
    const archimate = new Archimate();
    archimate.upsertElement({ id: 'actor', name: 'Actor', type: 'BusinessActor' });
    archimate.upsertElement({ id: 'role', name: 'Role', type: 'BusinessRole' });
    archimate.upsertRelationship({
      id: 'directed',
      name: 'd',
      type: 'AssociationRelationship',
      source: 'actor',
      target: 'role',
      directed: true,
    });
    archimate.upsertRelationship({ id: 'undirected', name: 'u', type: 'AssociationRelationship', source: 'role', target: 'actor' });

    expect(archimate.getRelationship('directed')?.directed).toBe(true);
    const relationships = schemaRelationships(archimate);
    expect(relationships.find(element => element['@_id'] === 'directed')?.['@_directed']).toBe('true');
    expect(relationships.find(element => element['@_id'] === 'undirected')).not.toHaveProperty('@_directed');
  });
});
