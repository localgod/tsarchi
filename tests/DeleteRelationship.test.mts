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

const connectionToConnection = 'tests/fixtures/roundtrip/connection-to-connection.archimate';

describe('deleteRelationship on a loaded model', () => {
  it('should remove loaded, nested and attached view connections', async () => {
    const archimate = await parseFile(connectionToConnection);

    expect(archimate.deleteRelationship('id-assignment')).toBe(true);

    expect(archimate.validateModel()).toEqual([]);
    const saved = collectById(archimate.serialize());
    expect(saved.has('id-assignment-connection')).toBe(false);
    expect(saved.has('id-assignment-association-connection')).toBe(false);
    expect(saved.has('id-contract-connection')).toBe(false);
    expect(saved.get('id-cashier-object')).not.toHaveProperty('@_targetConnections');
    expect(saved.get('id-contract-object')).not.toHaveProperty('@_targetConnections');
    expect(saved.get('id-clerk-object')).not.toHaveProperty('sourceConnection');
    expect(saved.get('id-contract-object')).not.toHaveProperty('sourceConnection');
  });

  it('should remove a connection drawn onto a connection and the reference to it', async () => {
    const archimate = await parseFile(connectionToConnection);

    expect(archimate.deleteRelationship('id-contract-association')).toBe(true);

    expect(archimate.validateModel()).toEqual([]);
    const saved = collectById(archimate.serialize());
    expect(saved.has('id-contract-connection')).toBe(false);
    expect(saved.get('id-assignment-connection')).not.toHaveProperty('@_targetConnections');
    expect(saved.has('id-assignment-association-connection')).toBe(true);
  });

  it('should remove a connection nested in a connection and keep its parent', async () => {
    const archimate = await parseFile(connectionToConnection);

    expect(archimate.deleteRelationship('id-assignment-association')).toBe(true);

    expect(archimate.validateModel()).toEqual([]);
    const saved = collectById(archimate.serialize());
    expect(saved.has('id-assignment-association-connection')).toBe(false);
    expect(saved.get('id-assignment-connection')).not.toHaveProperty('sourceConnection');
    expect(saved.get('id-assignment-connection')).toHaveProperty('bendpoint');
    expect(saved.get('id-contract-object')).not.toHaveProperty('@_targetConnections');
    expect(saved.has('id-contract-connection')).toBe(true);
  });

  it('should remove connections nested in diagram objects (Archi testDeleteHandler model)', async () => {
    const archimate = await parseFile('tests/fixtures/archi/testDeleteHandler.archimate');

    expect(archimate.deleteRelationship('3bede7f0')).toBe(true);
    expect(archimate.deleteRelationship('bfb084f7')).toBe(true);

    expect(archimate.validateModel()).toEqual([]);
    const saved = collectById(archimate.serialize());
    for (const id of ['5c85e0d2', '7958363b', 'db268768', '8cb15a1c']) {
      expect(saved.has(id)).toBe(false);
    }
    for (const id of ['5bed4b45', '3d225d7c', 'c9fc8676', '9fb7222b']) {
      expect(saved.get(id)).not.toHaveProperty('@_targetConnections');
    }
    expect(saved.has('afcd804b')).toBe(true);
  });

  it('should keep the other ids in a space-separated targetConnections (Archi Archisurance model)', async () => {
    const archimate = await parseFile('tests/fixtures/archi/Archisurance.archimate');

    expect(archimate.deleteRelationship('1788')).toBe(true);

    expect(archimate.validateModel()).toEqual([]);
    const saved = collectById(archimate.serialize());
    expect(saved.has('3751')).toBe(false);
    expect(saved.get('3735')?.['@_targetConnections']).toBe('3744');
  });
});
