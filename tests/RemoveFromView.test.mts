import { describe, expect, it } from 'vite-plus/test';
import { readFile } from 'fs/promises';
import { Archimate } from '../src/Archimate.mjs';
import { archimateToSchema } from '../src/internal/SchemaAccess.mjs';

async function load(path: string): Promise<Archimate> {
  return Archimate.fromXml(await readFile(path, 'utf8'));
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
const nestedDiagramObjects = 'tests/fixtures/roundtrip/nested-diagram-objects.archimate';

describe('removeDiagramObject', () => {
  it('should remove the object, its nested objects and their connections, and keep the elements and relationships', async () => {
    const archimate = await load(nestedDiagramObjects);

    const removed = archimate.removeDiagramObject('id-nested-view', 'id-portal-object');

    expect(removed[0]).toBe('id-portal-object');
    expect(new Set(removed)).toEqual(
      new Set(['id-portal-object', 'id-api-object', 'id-deep-portal-object', 'id-api-to-db', 'id-note-to-api', 'id-note-to-connection'])
    );
    expect(archimate.validateModel()).toEqual([]);
    expect(archimate.getElement('id-portal')).not.toBeNull();
    expect(archimate.getElement('id-api')).not.toBeNull();
    expect(archimate.getRelationship('id-rel-api-db')).not.toBeNull();

    const saved = collectById(archimateToSchema(archimate));
    for (const id of removed) expect(saved.has(id)).toBe(false);
    expect(saved.get('id-db-object')?.['@_targetConnections']).toBe('id-note-to-db');
    // The note keeps its one remaining connection, in the array it was loaded in.
    expect(saved.get('id-note')?.sourceConnection).toMatchObject([{ '@_id': 'id-note-to-db' }]);
  });

  it('should remove a group with everything in it', async () => {
    const archimate = await load(nestedDiagramObjects);

    expect(new Set(archimate.removeDiagramObject('id-nested-view', 'id-group'))).toEqual(
      new Set(['id-group', 'id-group-api-object', 'id-group-portal-object'])
    );
    expect(archimate.validateModel()).toEqual([]);
    expect(archimate.hasId('id-group-api-object')).toBe(false);
  });

  it('should remove an object nested at any depth and only that one of the objects showing its element', async () => {
    const archimate = await load(nestedDiagramObjects);

    expect(archimate.removeDiagramObject('id-nested-view', 'id-nested-portal-object')).toEqual([
      'id-nested-portal-object',
      'id-server-to-portal',
    ]);

    expect(archimate.validateModel()).toEqual([]);
    const saved = collectById(archimateToSchema(archimate));
    expect(saved.get('id-server-object')).not.toHaveProperty('child');
    expect(saved.get('id-server-object')).not.toHaveProperty('sourceConnection');
    expect(saved.has('id-portal-object')).toBe(true);
    expect(saved.has('id-deep-portal-object')).toBe(true);
  });

  it('should remove a note and the connections drawn from it', async () => {
    const archimate = await load(nestedDiagramObjects);

    expect(archimate.removeDiagramObject('id-nested-view', 'id-note')).toEqual([
      'id-note',
      'id-note-to-api',
      'id-note-to-connection',
      'id-note-to-db',
    ]);

    expect(archimate.validateModel()).toEqual([]);
    const saved = collectById(archimateToSchema(archimate));
    expect(saved.get('id-api-object')).not.toHaveProperty('@_targetConnections');
    expect(saved.get('id-api-to-db')).not.toHaveProperty('@_targetConnections');
    expect(saved.get('id-db-object')?.['@_targetConnections']).toBe('id-api-to-db');
  });

  it('should remove connections attached to a connection of the removed object', async () => {
    const archimate = await load(connectionToConnection);

    expect(new Set(archimate.removeDiagramObject('id-c2c-view', 'id-cashier-object'))).toEqual(
      new Set(['id-cashier-object', 'id-assignment-connection', 'id-assignment-association-connection', 'id-contract-connection'])
    );

    expect(archimate.validateModel()).toEqual([]);
    const saved = collectById(archimateToSchema(archimate));
    expect(saved.get('id-clerk-object')).not.toHaveProperty('sourceConnection');
    expect(saved.get('id-contract-object')).not.toHaveProperty('sourceConnection');
    expect(saved.get('id-contract-object')).not.toHaveProperty('@_targetConnections');
    expect(archimate.listRelationships()).toHaveLength(3);
  });

  it('should remove a diagram object added in code, with its connection', () => {
    const archimate = new Archimate();
    const a = archimate.upsertElement({ name: 'A', type: 'BusinessActor' });
    const b = archimate.upsertElement({ name: 'B', type: 'BusinessRole' });
    const relationship = archimate.upsertRelationship({ type: 'AssignmentRelationship', source: a.id, target: b.id });
    const view = archimate.createView('View');
    const aObject = archimate.addDiagramObject(view.id, a.id, { x: 0, y: 0, width: 120, height: 55 })!;
    const bObject = archimate.addDiagramObject(view.id, b.id, { x: 200, y: 0, width: 120, height: 55 })!;
    const connection = archimate.addConnection(view.id, aObject.id, bObject.id, relationship.id)!;

    expect(archimate.removeDiagramObject(view.id, bObject.id)).toEqual([bObject.id, connection.id]);

    const children = archimate.getView(view.id)!.children;
    expect(children.map(child => child.id)).toEqual([aObject.id]);
    expect(children[0].sourceConnections).toEqual([]);
    expect(archimate.getElement(b.id)).not.toBeNull();
    expect(archimate.getRelationship(relationship.id)).not.toBeNull();
    expect(archimate.validateModel()).toEqual([]);
    expect(Archimate.fromXml(archimate.toXml()).getView(view.id)!.children).toHaveLength(1);
  });

  it('should return an empty array for an unknown view or id, or the id of a connection', async () => {
    const archimate = await load(nestedDiagramObjects);
    const before = archimate.toXml();

    expect(archimate.removeDiagramObject('id-missing', 'id-portal-object')).toEqual([]);
    expect(archimate.removeDiagramObject('id-portal', 'id-portal-object')).toEqual([]);
    expect(archimate.removeDiagramObject('id-nested-view', 'id-missing')).toEqual([]);
    expect(archimate.removeDiagramObject('id-nested-view', 'id-api-to-db')).toEqual([]);
    expect(archimate.toXml()).toBe(before);
  });
});

describe('removeConnection', () => {
  it('should remove a connection with the connections nested in and attached to it, and keep the relationships', async () => {
    const archimate = await load(connectionToConnection);

    expect(archimate.removeConnection('id-c2c-view', 'id-assignment-connection')).toEqual([
      'id-assignment-connection',
      'id-assignment-association-connection',
      'id-contract-connection',
    ]);

    expect(archimate.validateModel()).toEqual([]);
    expect(archimate.listRelationships()).toHaveLength(3);
    const saved = collectById(archimateToSchema(archimate));
    expect(saved.get('id-clerk-object')).not.toHaveProperty('sourceConnection');
    expect(saved.get('id-contract-object')).not.toHaveProperty('sourceConnection');
    expect(saved.get('id-cashier-object')).not.toHaveProperty('@_targetConnections');
    expect(saved.get('id-contract-object')).not.toHaveProperty('@_targetConnections');
    expect(archimate.hasId('id-assignment-connection')).toBe(false);
  });

  it('should remove a connection nested in a connection and keep its parent', async () => {
    const archimate = await load(connectionToConnection);

    expect(archimate.removeConnection('id-c2c-view', 'id-assignment-association-connection')).toEqual([
      'id-assignment-association-connection',
    ]);

    expect(archimate.validateModel()).toEqual([]);
    const saved = collectById(archimateToSchema(archimate));
    expect(saved.has('id-assignment-connection')).toBe(true);
    expect(saved.get('id-assignment-connection')).not.toHaveProperty('sourceConnection');
    expect(saved.get('id-contract-object')).not.toHaveProperty('@_targetConnections');
  });

  it('should remove a connection drawn onto a connection and keep the one it ends on', async () => {
    const archimate = await load(nestedDiagramObjects);

    expect(archimate.removeConnection('id-nested-view', 'id-note-to-connection')).toEqual(['id-note-to-connection']);

    expect(archimate.validateModel()).toEqual([]);
    const saved = collectById(archimateToSchema(archimate));
    expect(saved.get('id-api-to-db')).not.toHaveProperty('@_targetConnections');
    expect(saved.get('id-note')?.sourceConnection).toHaveLength(2);
  });

  it('should keep the other ids in a space-separated targetConnections', async () => {
    const archimate = await load(nestedDiagramObjects);

    expect(archimate.removeConnection('id-nested-view', 'id-note-to-db')).toEqual(['id-note-to-db']);

    const saved = collectById(archimateToSchema(archimate));
    expect(saved.get('id-db-object')?.['@_targetConnections']).toBe('id-api-to-db');
  });

  it('should return an empty array for an unknown view or id, or the id of a diagram object', async () => {
    const archimate = await load(connectionToConnection);
    const before = archimate.toXml();

    expect(archimate.removeConnection('id-missing', 'id-assignment-connection')).toEqual([]);
    expect(archimate.removeConnection('id-c2c-view', 'id-missing')).toEqual([]);
    expect(archimate.removeConnection('id-c2c-view', 'id-clerk-object')).toEqual([]);
    expect(archimate.toXml()).toBe(before);
  });
});

describe('removeFromView', () => {
  it('should remove diagram children and connections together, as the single-id methods do one by one', async () => {
    const batch = await load(nestedDiagramObjects);
    const oneByOne = await load(nestedDiagramObjects);

    const removed = batch.removeFromView('id-nested-view', ['id-group', 'id-note-to-connection', 'id-nested-portal-object']);

    expect(new Set(removed)).toEqual(
      new Set([
        'id-group',
        'id-group-api-object',
        'id-group-portal-object',
        'id-nested-portal-object',
        'id-server-to-portal',
        'id-note-to-connection',
      ])
    );
    oneByOne.removeDiagramObject('id-nested-view', 'id-group');
    oneByOne.removeConnection('id-nested-view', 'id-note-to-connection');
    oneByOne.removeDiagramObject('id-nested-view', 'id-nested-portal-object');
    expect(batch.toXml()).toBe(oneByOne.toXml());
    expect(batch.validateModel()).toEqual([]);
    expect(batch.listRelationships()).toHaveLength(2);
  });

  it('should skip ids removed along with another id in the list, and ids not found', async () => {
    const archimate = await load(connectionToConnection);

    const removed = archimate.removeFromView('id-c2c-view', [
      'id-cashier-object',
      'id-contract-connection',
      'id-assignment-connection',
      'id-missing',
      'id-cashier-object',
    ]);

    expect(new Set(removed)).toEqual(
      new Set(['id-cashier-object', 'id-assignment-connection', 'id-assignment-association-connection', 'id-contract-connection'])
    );
    expect(removed).toHaveLength(4);
    expect(archimate.validateModel()).toEqual([]);
    expect(archimate.hasId('id-contract-connection')).toBe(false);
  });

  it('should take any iterable of ids', async () => {
    const archimate = await load(connectionToConnection);

    expect(archimate.removeFromView('id-c2c-view', new Set(['id-assignment-association-connection']))).toEqual([
      'id-assignment-association-connection',
    ]);
  });

  it('should return an empty array and leave the model unchanged for an unknown view, no ids or only unknown ids', async () => {
    const archimate = await load(connectionToConnection);
    const before = archimate.toXml();

    expect(archimate.removeFromView('id-missing', ['id-clerk-object'])).toEqual([]);
    expect(archimate.removeFromView('id-clerk', ['id-clerk-object'])).toEqual([]);
    expect(archimate.removeFromView('id-c2c-view', [])).toEqual([]);
    expect(archimate.removeFromView('id-c2c-view', ['id-missing', 'id-clerk'])).toEqual([]);
    expect(archimate.toXml()).toBe(before);
  });
});
