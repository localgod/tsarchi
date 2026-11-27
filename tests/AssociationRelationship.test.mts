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
