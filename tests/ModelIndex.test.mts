import { describe, expect, it, vi } from 'vitest';
import { Archimate } from '../src/Archimate.mjs';
import type { Child } from '../src/interfaces/Child.mjs';
import type { Model } from '../src/interfaces/Model.mjs';
import type { ModelContent } from '../src/interfaces/Model.mjs';
import { ModelIndex } from '../src/internal/ModelIndex.mjs';

type IndexInternals = {
  ids?: Set<string>;
  elements?: Map<string, { folderKey: string; element: object }>;
  relationships?: Map<string, object[]>;
  modelIds(): Iterable<string>;
};

const internals = (archimate: Archimate) => archimate as unknown as { model: Model; content: ModelContent; index: ModelIndex };

/** Builds every lookup, so that the next change has to keep them current rather than leave them to be built. */
function buildIndex(archimate: Archimate): void {
  const { index } = internals(archimate);
  index.hasId('');
  index.element('');
  index.relationshipsOf('');
}

/** Checks that what the index holds is what it would build from the model now. */
function expectIndexCurrent(archimate: Archimate): void {
  const { model, content, index } = internals(archimate);
  const cached = index as unknown as IndexInternals;
  const fresh = new ModelIndex(
    () => model,
    () => content.profiles
  ) as unknown as IndexInternals;

  if (cached.ids) expect(cached.ids).toEqual(new Set(fresh.modelIds()));

  if (cached.elements) {
    (fresh as unknown as ModelIndex).element('');
    expect([...cached.elements.keys()].sort()).toEqual([...fresh.elements!.keys()].sort());
    for (const [id, entry] of fresh.elements!) {
      expect(cached.elements.get(id)?.folderKey).toBe(entry.folderKey);
      expect(cached.elements.get(id)?.element).toBe(entry.element);
    }
  }

  if (cached.relationships) {
    (fresh as unknown as ModelIndex).relationshipsOf('');
    expect([...cached.relationships.keys()].sort()).toEqual([...fresh.relationships!.keys()].sort());
    for (const [id, relationships] of fresh.relationships!) {
      expect(cached.relationships.get(id)).toHaveLength(relationships.length);
      relationships.forEach((relationship, i) => expect(cached.relationships!.get(id)![i]).toBe(relationship));
    }
  }
}

function modelWithView() {
  const archimate = new Archimate();
  archimate.upsertElement({ id: 'app-a', name: 'A', type: 'ApplicationComponent' });
  archimate.upsertElement({ id: 'app-b', name: 'B', type: 'ApplicationComponent' });
  archimate.upsertElement({ id: 'node', name: 'Node', type: 'Node' });
  archimate.upsertRelationship({ id: 'flow', name: 'Data', type: 'FlowRelationship', source: 'app-a', target: 'app-b' });
  const view = archimate.createView('View');
  const a = archimate.addDiagramObject(view.id, 'app-a', { x: 0, y: 0, width: 120, height: 55 })!;
  const b = archimate.addDiagramObject(view.id, 'app-b', { x: 200, y: 0, width: 120, height: 55 })!;
  archimate.addConnection(view.id, a.id, b.id, 'flow');
  return { archimate, viewId: view.id, objectIds: [a.id, b.id] };
}

describe('the lookups behind hasId, getElement and findRelationshipsForElement', () => {
  const changes: [string, (archimate: Archimate, viewId: string, objectIds: string[]) => unknown][] = [
    ['upsertElement (new)', archimate => archimate.upsertElement({ name: 'C', type: 'ApplicationComponent' })],
    ['upsertElement (new, with id)', archimate => archimate.upsertElement({ id: 'app-c', name: 'C', type: 'ApplicationComponent' })],
    ['upsertElement (existing)', archimate => archimate.upsertElement({ id: 'app-a', name: 'A2', type: 'ApplicationComponent' })],
    [
      'upsertElement (existing view, new children)',
      (archimate, viewId) => archimate.upsertElement({ id: viewId, name: 'V', type: 'ArchimateDiagramModel', child: [] }),
    ],
    ['updateElement (name)', archimate => archimate.updateElement('app-a', { name: 'A2' })],
    ['updateElement (type moves it to another folder)', archimate => archimate.updateElement('app-a', { type: 'BusinessActor' })],
    ['updateElement (relationship target)', archimate => archimate.updateElement('flow', { target: 'node' })],
    [
      'updateElement (view children)',
      (archimate, viewId) =>
        archimate.updateElement(viewId, {
          child: [
            { id: 'new-object', type: 'DiagramObject', archimateElement: 'node', bounds: { x: 0, y: 0, width: 1, height: 1 } } as Child,
          ],
        }),
    ],
    ['deleteElement (element)', archimate => archimate.deleteElement('app-b')],
    ['deleteElement (relationship)', archimate => archimate.deleteElement('flow')],
    [
      'upsertRelationship (new)',
      archimate => archimate.upsertRelationship({ name: '', type: 'ServingRelationship', source: 'app-b', target: 'app-a' }),
    ],
    [
      'upsertRelationship (existing)',
      archimate => archimate.upsertRelationship({ id: 'flow', name: '', type: 'FlowRelationship', source: 'app-a', target: 'node' }),
    ],
    ['deleteRelationship', archimate => archimate.deleteRelationship('flow')],
    ['createView', archimate => archimate.createView('Other')],
    ['addDiagramObject', (archimate, viewId) => archimate.addDiagramObject(viewId, 'node', { x: 0, y: 0, width: 1, height: 1 })],
    [
      'addGroup and addDiagramObjectToGroup',
      (archimate, viewId) => {
        const group = archimate.addGroup(viewId, 'Group', { x: 0, y: 0, width: 300, height: 300 })!;
        archimate.addDiagramObjectToGroup(viewId, group.id, 'node', { x: 10, y: 10, width: 1, height: 1 });
      },
    ],
    ['addConnection', (archimate, viewId, [a, b]) => archimate.addConnection(viewId, b, a)],
    ['deleteView', (archimate, viewId) => archimate.deleteView(viewId)],
    ['createFolder', archimate => archimate.createFolder(archimate.getFolder('application').id, { name: 'Sub' })],
    [
      'deleteFolder',
      archimate => {
        const folder = archimate.createFolder(archimate.getFolder('application').id, { name: 'Sub' });
        archimate.moveElementToFolder('app-a', folder.id);
        buildIndex(archimate);
        archimate.deleteFolder(folder.id);
      },
    ],
    ['setProfiles', archimate => archimate.setProfiles([{ id: 'profile', name: 'Draft', conceptType: 'ApplicationComponent' }])],
    ['restore', archimate => archimate.restore(new Archimate().snapshot())],
  ];

  it.each(changes)('should stay current after %s', (_, change) => {
    const { archimate, viewId, objectIds } = modelWithView();
    buildIndex(archimate);

    change(archimate, viewId, objectIds);

    expectIndexCurrent(archimate);
  });

  it('should stay current through a series of changes', () => {
    const { archimate, viewId, objectIds } = modelWithView();
    for (const [, change] of changes.slice(0, -1)) {
      buildIndex(archimate);
      try {
        change(archimate, viewId, objectIds);
      } catch {
        // Some changes no longer apply after earlier ones, such as deleting what is already deleted.
      }
      expectIndexCurrent(archimate);
    }
  });
});

describe('upsertRelationship with an id that is in use', () => {
  it('should throw when the id is used by an element, and leave the model unchanged', () => {
    const { archimate } = modelWithView();

    expect(() =>
      archimate.upsertRelationship({ id: 'app-a', name: '', type: 'FlowRelationship', source: 'app-b', target: 'node' })
    ).toThrow('ID "app-a" is already in use.');
    expect(archimate.listRelationships().map(relationship => relationship.id)).toEqual(['flow']);
    expect(archimate.validateModel().filter(issue => issue.code === 'duplicate-id')).toEqual([]);
  });

  it('should throw when the id is used by a diagram object', () => {
    const { archimate, objectIds } = modelWithView();

    expect(() =>
      archimate.upsertRelationship({ id: objectIds[0], name: '', type: 'FlowRelationship', source: 'app-b', target: 'node' })
    ).toThrow('is already in use');
  });
});

describe('building a model', () => {
  it('should list the ids in the model once, not on every insert', () => {
    const walk = vi.spyOn(ModelIndex.prototype as unknown as IndexInternals, 'modelIds');
    const archimate = new Archimate();
    const view = archimate.createView('View');
    let previous: string | undefined;
    for (let i = 0; i < 50; i++) {
      archimate.upsertElement({ id: `app-${i}`, name: `App ${i}`, type: 'ApplicationComponent' });
      archimate.upsertElement({ name: `Unnamed ${i}`, type: 'ApplicationComponent' });
      if (i > 0)
        archimate.upsertRelationship({ id: `flow-${i}`, name: '', type: 'FlowRelationship', source: `app-${i - 1}`, target: `app-${i}` });
      const object = archimate.addDiagramObject(view.id, `app-${i}`, { x: i * 10, y: 0, width: 120, height: 55 })!;
      if (previous) archimate.addConnection(view.id, previous, object.id, `flow-${i}`);
      previous = object.id;
    }

    expect(walk).toHaveBeenCalledTimes(1);
    walk.mockRestore();
  });
});
