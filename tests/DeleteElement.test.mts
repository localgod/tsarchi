import { describe, expect, it } from 'vitest';
import { readFile } from 'fs/promises';
import { XMLParser } from 'fast-xml-parser';
import { Archimate } from '../src/Archimate.mjs';
import type { Schema } from '../src/interfaces/schema/Schema.mjs';

async function parseFile(path: string): Promise<Archimate> {
  const xml = await readFile(path, 'utf8');
  const raw = new XMLParser({ ignoreAttributes: false }).parse(xml) as Schema;
  const archimate = new Archimate();
  archimate.parse(raw);
  return archimate;
}

/**
 * Every object in the serialized model that has an `@_id`, keyed by id.
 */
function collectById(node: unknown, found = new Map<string, Record<string, unknown>>()): Map<string, Record<string, unknown>> {
  if (Array.isArray(node)) {
    node.forEach(item => collectById(item, found));
  } else if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (typeof record['@_id'] === 'string') found.set(record['@_id'], record);
    Object.values(record).forEach(value => collectById(value, found));
  }
  return found;
}

const nestedDiagramObjects = 'tests/fixtures/roundtrip/nested-diagram-objects.archimate';

describe('deleteElement', () => {
  it('should remove diagram objects for the element at any depth, with their contents and connections', async () => {
    const archimate = await parseFile(nestedDiagramObjects);

    expect(archimate.deleteElement('id-portal')).toBe(true);

    expect(archimate.validateModel()).toEqual([]);
    const saved = collectById(archimate.serialize());
    for (const id of [
      'id-portal-object',
      'id-api-object',
      'id-deep-portal-object',
      'id-api-to-db',
      'id-nested-portal-object',
      'id-server-to-portal',
      'id-group-portal-object',
      'id-note-to-api',
      'id-note-to-connection',
    ]) {
      expect(saved.has(id), id).toBe(false);
    }
    expect(saved.get('id-server-object')).not.toHaveProperty('child');
    expect(saved.get('id-server-object')).not.toHaveProperty('sourceConnection');
    expect(saved.get('id-group-api-object')).not.toHaveProperty('child');
    expect(saved.get('id-db-object')?.['@_targetConnections']).toBe('id-note-to-db');
    expect(saved.get('id-note')?.sourceConnection).toEqual([expect.objectContaining({ '@_id': 'id-note-to-db' })]);
    // The relationship between the remaining elements stays; only its connection in the removed object goes.
    expect(archimate.getRelationship('id-rel-api-db')).not.toBeNull();
  });

  it('should only remove diagram objects for the deleted element', async () => {
    const archimate = await parseFile(nestedDiagramObjects);

    expect(archimate.deleteElement('id-server')).toBe(true);

    expect(archimate.validateModel()).toEqual([]);
    const saved = collectById(archimate.serialize());
    expect(saved.has('id-server-object')).toBe(false);
    expect(saved.has('id-nested-portal-object')).toBe(false);
    expect(saved.has('id-portal-object')).toBe(true);
    expect(saved.has('id-group-portal-object')).toBe(true);
  });
});
