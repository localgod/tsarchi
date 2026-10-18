import { describe, expect, it } from 'vite-plus/test';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { Archimate } from '../src/Archimate.mjs';
import { ArchimateParseError } from '../src/interfaces/ArchimateParseError.mjs';
import type { ModelSnapshot } from '../src/interfaces/ModelSnapshot.mjs';
import { archimateToSchema } from '../src/internal/SchemaAccess.mjs';
import { buildArchimateXml } from '../src/internal/Xml.mjs';

const fixtureDirs = ['tests/fixtures/roundtrip', 'tests/fixtures/archi'];

async function fixtures(): Promise<{ path: string; xml: string }[]> {
  const files = await Promise.all(
    fixtureDirs.map(async dir => (await readdir(dir)).filter(name => name.endsWith('.archimate')).map(name => join(dir, name)))
  );
  return Promise.all(files.flat().map(async path => ({ path, xml: await readFile(path, 'utf8') })));
}

/**
 * What toXml() writes, without validating first: the fixtures in tests/fixtures/archi may not validate.
 */
function written(archimate: Archimate): string {
  return buildArchimateXml(archimateToSchema(archimate));
}

function json(archimate: Archimate): string {
  return JSON.stringify(archimate.snapshot());
}

/**
 * The private state a snapshot replaces.
 */
function state(archimate: Archimate): unknown {
  const fields = archimate as unknown as Record<string, unknown>;
  return { model: fields.model, content: fields.content, xmlMetadata: fields.xmlMetadata, modelMetadata: fields.modelMetadata };
}

function modelBuiltInCode(): Archimate {
  const archimate = new Archimate();
  archimate.setName('Built in code');
  archimate.setProperties(new Map([['owner', 'team']]));
  const actor = archimate.upsertElement({ name: 'Customer', type: 'BusinessActor', documentation: 'Buys things' });
  const role = archimate.upsertElement({ name: 'Buyer', type: 'BusinessRole', properties: new Map([['k', 'v']]) });
  const app = archimate.upsertElement({ name: 'Shop', type: 'ApplicationComponent' });
  const assignment = archimate.upsertRelationship({ name: '', type: 'AssignmentRelationship', source: actor.id, target: role.id });
  archimate.upsertRelationship({ name: 'uses', type: 'ServingRelationship', source: app.id, target: role.id });

  const folder = archimate.createFolder(archimate.getFolder('business').id, { name: 'People' });
  archimate.moveElementToFolder(role.id, folder.id);
  archimate.moveElementToFolder(actor.id, folder.id);

  const view = archimate.createView('Overview', { documentation: 'Main view' });
  const group = archimate.addGroup(view.id, 'Business', { x: 10, y: 10, width: 400, height: 200 });
  const actorObject = archimate.addDiagramObject(view.id, actor.id, { x: 20, y: 40, width: 120, height: 55 }, { fillColor: '#ffffff' });
  const roleObject = archimate.addDiagramObject(view.id, role.id, { x: 200, y: 40, width: 120, height: 55 });
  archimate.addConnection(view.id, actorObject.id, roleObject.id, assignment.id, { lineWidth: 2 });
  archimate.updateDiagramObjectStyle(view.id, roleObject.id, { lineColor: '#000000', textAlignment: 2 });
  expect(group.id).toBeTruthy();
  return archimate;
}

describe('model snapshots of fixtures', () => {
  it('should restore every fixture to the same model and XML', async () => {
    for (const { path, xml } of await fixtures()) {
      const model = Archimate.fromXml(xml);
      const snapshot = model.snapshot();

      const copy = Archimate.fromSnapshot(snapshot);
      const restored = new Archimate();
      restored.restore(snapshot);
      const throughJson = Archimate.fromSnapshot(JSON.parse(JSON.stringify(snapshot)));

      expect(written(copy), path).toBe(written(model));
      expect(written(restored), path).toBe(written(model));
      expect(written(throughJson), path).toBe(written(model));
      // The restored model is the one fromXml() would load from the same model's XML.
      expect(state(copy), path).toEqual(state(Archimate.fromXml(written(model))));
    }
  });

  it('should give the same snapshot for models that write the same XML', async () => {
    for (const { path, xml } of await fixtures()) {
      const model = Archimate.fromXml(xml);
      const snapshot = json(model);

      expect(json(Archimate.fromXml(written(model))), path).toBe(snapshot);
      expect(json(Archimate.fromSnapshot(model.snapshot())), path).toBe(snapshot);
      expect(json(Archimate.fromSnapshot(JSON.parse(snapshot))), path).toBe(snapshot);
    }
  });
});

describe('model snapshots of models built in code', () => {
  it('should give the same snapshot as the model loaded from its XML', () => {
    const model = modelBuiltInCode();

    expect(json(Archimate.fromXml(model.toXml()))).toBe(json(model));
    expect(Archimate.fromSnapshot(model.snapshot()).toXml()).toBe(model.toXml());
  });

  it('should hold no Maps, so JSON keeps every property', () => {
    const model = modelBuiltInCode();

    const throughJson = Archimate.fromSnapshot(JSON.parse(JSON.stringify(model.snapshot())));

    expect(throughJson.getProperties()).toEqual(new Map([['owner', 'team']]));
    expect(throughJson.findElementsByName('Buyer')[0].properties).toEqual(new Map([['k', 'v']]));
  });

  it('should not depend on the order of keys in the stored objects', () => {
    const first = new Archimate();
    first.upsertElement({ id: 'id-a', name: 'A', type: 'BusinessActor', documentation: 'Doc' });
    const second = new Archimate();
    second.upsertElement({ documentation: 'Doc', type: 'BusinessActor', name: 'A', id: 'id-a' });
    for (const key of [
      'business',
      'strategy',
      'application',
      'technology',
      'motivation',
      'implementation_migration',
      'other',
      'relations',
      'diagrams',
    ]) {
      const folderId = (first as unknown as Record<string, Record<string, { id: string }>>).model[key].id;
      (second as unknown as Record<string, Record<string, { id: string }>>).model[key].id = folderId;
    }

    expect(json(second)).toBe(json(first));
  });

  it('should write style settings held only in typed fields as features', () => {
    const model = modelBuiltInCode();
    const view = (model as unknown as { model: { diagrams: { elements: { child: Record<string, unknown>[] }[] } } }).model.diagrams
      .elements[0];
    const child = view.child[1];
    child.lineAlpha = 100;
    child.gradient = 1;
    child.features = new Map([['gradient', '0']]);

    const snapshot = json(model);

    expect(snapshot).toContain('"features":[["gradient","1"],["lineAlpha","100"]]');
    expect(json(Archimate.fromXml(model.toXml()))).toBe(snapshot);
    expect(model.getView(model.listViews()[0].id)?.children[1].lineAlpha).toBe(100);
    expect(Archimate.fromSnapshot(model.snapshot()).getView(model.listViews()[0].id)?.children[1].lineAlpha).toBe(100);
  });

  it('should leave out empty values that toXml() does not write', () => {
    const model = new Archimate();
    model.upsertElement({ id: 'id-a', name: 'A', type: 'BusinessActor', documentation: '', properties: new Map() });

    const element = model.snapshot().folders.business.elements?.[0];

    expect(element).toEqual({ id: 'id-a', type: 'BusinessActor', name: 'A' });
  });
});

describe('restore', () => {
  it('should replace the content of the instance it is called on', () => {
    const model = modelBuiltInCode();
    const before = model.snapshot();
    const actor = model.findElementsByName('Customer')[0];

    model.deleteElement(actor.id);
    expect(model.getElement(actor.id)).toBeNull();
    model.restore(before);

    expect(model.getElement(actor.id)?.name).toBe('Customer');
    expect(json(model)).toBe(JSON.stringify(before));
  });

  it('should let the view methods change the restored views', () => {
    const model = modelBuiltInCode();
    const snapshot = model.snapshot();
    const other = new Archimate();
    other.restore(snapshot);
    const view = other.listViews()[0];
    const app = other.findElementsByName('Shop')[0];

    other.addDiagramObject(view.id, app.id, { x: 400, y: 40, width: 120, height: 55 });

    expect(other.getView(view.id)?.children.some(child => child.archimateElement === app.id)).toBe(true);
    expect(other.toXml()).toContain(`archimateElement="${app.id}"`);
  });

  it('should make hasId() and generateUniqueId() follow the restored content', () => {
    const before = new Archimate();
    before.upsertElement({ id: 'id-old', name: 'Old', type: 'BusinessActor' });
    const after = new Archimate();
    after.upsertElement({ id: 'id-new', name: 'New', type: 'BusinessActor' });

    before.restore(after.snapshot());

    expect(before.hasId('id-new')).toBe(true);
    expect(before.hasId('id-old')).toBe(false);
    const restoredIds = JSON.stringify(after.snapshot());
    for (let i = 0; i < 100; i++) {
      expect(restoredIds).not.toContain(before.generateUniqueId());
    }
  });

  it('should restore the same snapshot twice', () => {
    const model = modelBuiltInCode();
    const snapshot = model.snapshot();
    const text = JSON.stringify(snapshot);

    model.restore(snapshot);
    model.upsertElement({ name: 'Added', type: 'Node' });
    model.findElementsByName('Customer').forEach(element => model.updateElement(element.id, { name: 'Changed' }));
    model.restore(snapshot);

    expect(JSON.stringify(snapshot)).toBe(text);
    expect(json(model)).toBe(text);
  });
});

describe('snapshots are copies', () => {
  it('should not change the model when a snapshot is changed after it is taken', () => {
    const model = modelBuiltInCode();
    const text = json(model);
    const snapshot = model.snapshot();

    snapshot.folders.business.folders![0].elements![0].name = 'Changed';
    snapshot.properties![0][1] = 'changed';
    snapshot.folders.diagrams.elements![0].children![0].bounds.x = 999;

    expect(json(model)).toBe(text);
  });

  it('should not change the model when a snapshot is changed after it is restored', () => {
    const source = modelBuiltInCode();
    source.upsertElement({ id: 'id-x', name: 'X', type: 'Node', unrecognized: { '@_extra': 'a', nested: { value: 'b' } } });
    const snapshot = source.snapshot();
    const model = Archimate.fromSnapshot(snapshot);
    const text = json(model);

    const node = snapshot.folders.technology.elements![0];
    node.name = 'Changed';
    (node.unrecognized!.nested as Record<string, string>).value = 'changed';
    snapshot.properties![0][1] = 'changed';

    expect(json(model)).toBe(text);
  });
});

describe('invalid snapshots', () => {
  function expectRejected(model: Archimate, input: unknown, message: RegExp): void {
    const text = json(model);
    let error: unknown;
    try {
      model.restore(input as ModelSnapshot);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ArchimateParseError);
    expect((error as ArchimateParseError).kind).toBe('invalid-structure');
    expect((error as Error).message).toMatch(message);
    expect(json(model)).toBe(text);
  }

  function validSnapshot(): Record<string, any> {
    return JSON.parse(JSON.stringify(modelBuiltInCode().snapshot()));
  }

  it('should reject values that are not snapshots', () => {
    const model = modelBuiltInCode();

    expectRejected(model, null, /snapshot: expected an object/);
    expectRejected(model, '{}', /snapshot: expected an object/);
    expectRejected(model, [], /snapshot: expected an object/);
    expectRejected(model, {}, /snapshot.version: unsupported version/);
  });

  it('should reject an unknown version', () => {
    const snapshot = validSnapshot();
    snapshot.version = 2;

    expectRejected(modelBuiltInCode(), snapshot, /snapshot.version: unsupported version 2/);
  });

  it('should reject a value of the wrong type deep in the snapshot', () => {
    const snapshot = validSnapshot();
    snapshot.folders.diagrams.elements[0].children[1].bounds.x = '10';

    expectRejected(modelBuiltInCode(), snapshot, /snapshot.folders.diagrams.elements\[0\].children\[1\].bounds.x: expected a number/);
  });

  it('should reject unknown keys and missing folders', () => {
    const unknownKey = validSnapshot();
    unknownKey.folders.business.folders[0].elements[0].colour = 'red';
    const missingFolder = validSnapshot();
    delete missingFolder.folders.motivation;

    expectRejected(modelBuiltInCode(), unknownKey, /unexpected key 'colour'/);
    expectRejected(modelBuiltInCode(), missingFolder, /missing folder 'motivation'/);
  });

  it('should reject malformed entries and opaque data that is not JSON', () => {
    const entries = validSnapshot();
    entries.properties = [['owner']];
    const opaque = validSnapshot();
    opaque.unrecognized = { when: new Date() };

    expectRejected(modelBuiltInCode(), entries, /snapshot.properties\[0\]: expected a \[key, value\] pair/);
    expectRejected(modelBuiltInCode(), opaque, /snapshot.unrecognized.when is not JSON data/);
  });

  it('should turn any other error into an ArchimateParseError', () => {
    const snapshot = validSnapshot();
    Object.defineProperty(snapshot.folders.business, 'name', {
      enumerable: true,
      get() {
        throw new Error('getter failed');
      },
    });

    expectRejected(modelBuiltInCode(), snapshot, /getter failed/);
  });

  it('should copy a __proto__ key in opaque data as a plain property', () => {
    const snapshot = validSnapshot();
    snapshot.folders.technology.elements = JSON.parse(
      '[{"id":"id-node","type":"Node","name":"N","unrecognized":{"__proto__":{"polluted":true},"@_extra":"a"}}]'
    );

    const model = Archimate.fromSnapshot(snapshot as ModelSnapshot);
    const unrecognized = model.getElement('id-node')?.unrecognized as Record<string, unknown>;

    expect(Object.getPrototypeOf(unrecognized)).toBe(Object.prototype);
    expect(Object.hasOwn(unrecognized, '__proto__')).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(json(model)).toContain('"__proto__":{"polluted":true}');
  });

  it('should reject a __proto__ key where the snapshot has fixed keys', () => {
    const snapshot = validSnapshot();
    snapshot.folders.technology.elements = JSON.parse('[{"id":"id-node","type":"Node","name":"N","__proto__":{"name":"X"}}]');

    expectRejected(modelBuiltInCode(), snapshot, /unexpected key '__proto__'/);
  });
});
