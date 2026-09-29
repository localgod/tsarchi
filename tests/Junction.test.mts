import { describe, expect, it } from 'vitest';
import { readFile } from 'fs/promises';
import { XMLParser } from 'fast-xml-parser';
import { Archimate } from '../src/Archimate.mjs';
import type { Schema } from '../src/interfaces/schema/Schema.mjs';
import type { Element as SchemaElement } from '../src/interfaces/schema/Element.mjs';
import type { Folder as SchemaFolder } from '../src/interfaces/schema/Folder.mjs';

async function parseFile(path: string): Promise<Archimate> {
  const xml = await readFile(path, 'utf8');
  const raw = new XMLParser({ ignoreAttributes: false }).parse(xml) as Schema;
  const archimate = new Archimate();
  archimate.parse(raw);
  return archimate;
}

function schemaJunctions(archimate: Archimate): SchemaElement[] {
  const folders = archimate.serialize()['archimate:model'].folder as SchemaFolder | SchemaFolder[];
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
