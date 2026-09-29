import { describe, expect, it } from 'vitest';
import { readFile } from 'fs/promises';
import { XMLParser } from 'fast-xml-parser';
import { Archimate } from '../src/Archimate.mjs';
import type { Schema } from '../src/interfaces/schema/Schema.mjs';

async function parseFile(path: string, edit: (xml: string) => string = xml => xml): Promise<Archimate> {
  const xml = edit(await readFile(path, 'utf8'));
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

const viewReferences = 'tests/fixtures/roundtrip/view-references.archimate';

describe('deleteView', () => {
  it('should remove references to the deleted view at any depth, with their connections', async () => {
    const archimate = await parseFile(viewReferences);

    expect(archimate.deleteView('id-detail')).toBe(true);

    expect(archimate.validateModel()).toEqual([]);
    const saved = collectById(archimate.serialize());
    expect(saved.has('id-detail')).toBe(false);
    expect(saved.has('id-ref-overview')).toBe(false);
    expect(saved.has('id-ref-detail')).toBe(false);
    expect(saved.has('id-nested-ref-detail')).toBe(false);
    expect(saved.has('id-ref-to-note')).toBe(false);
    expect(saved.has('id-note-to-ref')).toBe(false);
    expect(saved.get('id-note')).not.toHaveProperty('@_targetConnections');
    expect(saved.get('id-note')).not.toHaveProperty('sourceConnection');
    expect(saved.get('id-portal-object')).not.toHaveProperty('child');
    expect(saved.get('id-ref-other-view')?.['@_model']).toBe('id-other');
  });

  it('should only remove references to the deleted view', async () => {
    const archimate = await parseFile(viewReferences);
    const before = collectById(archimate.serialize());

    expect(archimate.deleteView('id-missing')).toBe(false);
    expect(archimate.deleteView('id-other')).toBe(true);

    const saved = collectById(archimate.serialize());
    expect(saved.has('id-ref-other-view')).toBe(false);
    expect(saved.get('id-ref-detail')).toEqual(before.get('id-ref-detail'));
    expect(archimate.validateModel()).toEqual([]);
  });
});

describe('validateModel', () => {
  it('should report a diagram reference to a missing view', async () => {
    const archimate = await parseFile(viewReferences, xml => xml.replace('model="id-other"', 'model="id-missing"'));

    expect(archimate.validateModel()).toEqual([
      expect.objectContaining({ code: 'diagram-reference-missing-view', id: 'id-ref-other-view' }),
    ]);
  });
});
