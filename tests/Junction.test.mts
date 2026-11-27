import { describe, expect, it } from 'vite-plus/test';
import { Archimate } from '../src/Archimate.mjs';
import type { Element as SchemaElement } from '../src/interfaces/schema/Element.mjs';
import type { Folder as SchemaFolder } from '../src/interfaces/schema/Folder.mjs';
import { archimateToSchema } from '../src/internal/SchemaAccess.mjs';
import { parseFile } from './helpers.mjs';

function schemaJunctions(archimate: Archimate): SchemaElement[] {
  const folders = archimateToSchema(archimate)['archimate:model'].folder as SchemaFolder | SchemaFolder[];
  const other = (Array.isArray(folders) ? folders : [folders]).find(folder => folder['@_type'] === 'other');
  const elements = other?.element;
  return Array.isArray(elements) ? elements : elements ? [elements] : [];
}

describe('junctions', () => {
  it('should load the junction type, leaving AND junctions without one', async () => {
    const archimate = await parseFile('tests/fixtures/roundtrip/junctions.archimate');

    expect(archimate.getElement('id-jn-or')?.junctionType).toBe('or');
    expect(archimate.getElement('id-jn-and')?.junctionType).toBeUndefined();
  });

  it('should save an OR junction created in code', () => {
    const archimate = new Archimate();
    archimate.upsertElement({ id: 'or-junction', name: 'or', type: 'Junction', junctionType: 'or' });
    archimate.upsertElement({ id: 'and-junction', name: 'and', type: 'Junction' });

    const junctions = schemaJunctions(archimate);
    expect(junctions.find(element => element['@_id'] === 'or-junction')?.['@_type']).toBe('or');
    expect(junctions.find(element => element['@_id'] === 'and-junction')).not.toHaveProperty('@_type');
  });
});
