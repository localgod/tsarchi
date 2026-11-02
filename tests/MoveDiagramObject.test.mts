import { describe, expect, it } from 'vite-plus/test';
import { readFile } from 'fs/promises';
import { Archimate } from '../src/Archimate.mjs';
import type { ViewChild } from '../src/interfaces/ViewChild.mjs';

const nestedDiagramObjects = 'tests/fixtures/roundtrip/nested-diagram-objects.archimate';
const sketchAndCanvas = 'tests/fixtures/roundtrip/sketch-and-canvas.archimate';
const view = 'id-nested-view';
const bounds = { x: 24, y: 48, width: 120, height: 55 };

async function load(path: string): Promise<Archimate> {
  return Archimate.fromXml(await readFile(path, 'utf8'));
}

/** A diagram child at any depth of a view. */
function findViewChild(archimate: Archimate, viewId: string, id: string): ViewChild {
  const find = (children: ViewChild[]): ViewChild | undefined => {
    for (const child of children) {
      const found = child.id === id ? child : find(child.children);
      if (found) return found;
    }
    return undefined;
  };
  return find(archimate.getView(viewId)!.children)!;
}

/** The ids of the children of the view (parentId null) or of a diagram child, in order. */
function childIds(archimate: Archimate, viewId: string, parentId: string | null): string[] {
  const children = parentId === null ? archimate.getView(viewId)!.children : findViewChild(archimate, viewId, parentId).children;
  return children.map(child => child.id);
}

describe('moveDiagramObject', () => {
  it('should move an object from the view into a group, at the end, keeping its id and connections', async () => {
    const archimate = await load(nestedDiagramObjects);

    expect(archimate.moveDiagramObject(view, 'id-db-object', 'id-group', bounds)).toEqual({ parentId: null, index: 3 });

    expect(childIds(archimate, view, null)).toEqual(['id-portal-object', 'id-server-object', 'id-group', 'id-note']);
    expect(childIds(archimate, view, 'id-group')).toEqual(['id-group-api-object', 'id-db-object']);
    expect(findViewChild(archimate, view, 'id-db-object')).toMatchObject({ id: 'id-db-object', archimateElement: 'id-db', bounds, targetConnections: ['id-api-to-db', 'id-note-to-db'] });
    expect(archimate.validateModel()).toEqual([]);
  });

  it('should move an object out of a group onto the view, with what is nested in it', async () => {
    const archimate = await load(nestedDiagramObjects);

    expect(archimate.moveDiagramObject(view, 'id-group-api-object', null, bounds)).toEqual({ parentId: 'id-group', index: 0 });

    expect(childIds(archimate, view, 'id-group')).toEqual([]);
    expect(childIds(archimate, view, null).at(-1)).toBe('id-group-api-object');
    expect(childIds(archimate, view, 'id-group-api-object')).toEqual(['id-group-portal-object']);
    expect(archimate.validateModel()).toEqual([]);
  });

  it('should move an object with connections from deep inside one element into another element', async () => {
    const archimate = await load(nestedDiagramObjects);

    expect(archimate.moveDiagramObject(view, 'id-api-object', 'id-server-object', bounds)).toEqual({
      parentId: 'id-portal-object',
      index: 0,
    });

    expect(childIds(archimate, view, 'id-portal-object')).toEqual([]);
    expect(childIds(archimate, view, 'id-server-object')).toEqual(['id-nested-portal-object', 'id-api-object']);
    const reloaded = Archimate.fromXml(archimate.toXml());
    expect(findViewChild(reloaded, view, 'id-api-object')).toMatchObject({
      id: 'id-api-object',
      bounds,
      targetConnections: ['id-note-to-api'],
      sourceConnections: [{ id: 'id-api-to-db', targetConnections: ['id-note-to-connection'] }],
      children: [{ id: 'id-deep-portal-object' }],
    });
    expect(reloaded.validateModel()).toEqual([]);
  });

  it('should put the object at options.index among the parent’s other children', async () => {
    const archimate = await load(nestedDiagramObjects);

    archimate.moveDiagramObject(view, 'id-db-object', 'id-group', bounds, { index: 0 });

    expect(childIds(archimate, view, 'id-group')).toEqual(['id-db-object', 'id-group-api-object']);
  });

  it('should reorder within the same parent, counting the index among the other children', async () => {
    const archimate = await load(nestedDiagramObjects);
    const noteBounds = findViewChild(archimate, view, 'id-note').bounds;

    expect(archimate.moveDiagramObject(view, 'id-note', null, noteBounds, { index: 0 })).toEqual({ parentId: null, index: 4 });
    expect(childIds(archimate, view, null)).toEqual(['id-note', 'id-portal-object', 'id-server-object', 'id-group', 'id-db-object']);

    // Without an index it goes to the end, the last of the other four.
    expect(archimate.moveDiagramObject(view, 'id-note', null, noteBounds)).toEqual({ parentId: null, index: 0 });
    expect(childIds(archimate, view, null).at(-1)).toBe('id-note');
  });

  it('should put the object back exactly when called again with what it returned', async () => {
    const archimate = await load(nestedDiagramObjects);
    const original = archimate.toXml();

    for (const [id, parentId] of [
      ['id-server-object', 'id-group'],
      ['id-api-object', null],
      ['id-group', 'id-portal-object'],
      ['id-note', 'id-server-object'],
    ] as const) {
      const oldBounds = findViewChild(archimate, view, id).bounds;
      const from = archimate.moveDiagramObject(view, id, parentId, bounds)!;
      expect(archimate.toXml()).not.toBe(original);
      expect(archimate.moveDiagramObject(view, id, from.parentId, oldBounds, { index: from.index })).not.toBeNull();
      expect(archimate.toXml()).toBe(original);
    }
  });

  it('should move groups, notes and view references, and nest a group in a group', async () => {
    const archimate = await load(nestedDiagramObjects);
    const inner = archimate.addGroup(view, 'Inner', bounds)!;

    expect(archimate.moveDiagramObject(view, inner.id, 'id-group', bounds)).not.toBeNull();
    expect(archimate.moveDiagramObject(view, 'id-note', inner.id, bounds)).not.toBeNull();

    expect(childIds(archimate, view, 'id-group')).toEqual(['id-group-api-object', inner.id]);
    expect(childIds(archimate, view, inner.id)).toEqual(['id-note']);
    expect(archimate.validateModel()).toEqual([]);
  });

  it('should move into sketch stickies and canvas blocks', async () => {
    const archimate = await load(sketchAndCanvas);

    expect(archimate.moveDiagramObject('id-sketch', 'id-sketch-actor', 'id-sticky', bounds)).toEqual({ parentId: null, index: 1 });
    expect(childIds(archimate, 'id-sketch', 'id-sticky')).toEqual(['id-sketch-actor']);
    expect(archimate.moveDiagramObject('id-canvas', 'id-canvas-sticky', 'id-block', bounds)).toEqual({ parentId: null, index: 2 });
    expect(childIds(archimate, 'id-canvas', 'id-block')).toEqual(['id-nested-sticky', 'id-canvas-sticky']);
    expect(archimate.validateModel()).toEqual([]);
  });

  it('should return null and change nothing when the move is refused', async () => {
    const archimate = await load(nestedDiagramObjects);
    const sketch = await load(sketchAndCanvas);
    const other = archimate.createView('Other');
    const otherGroup = archimate.addGroup(other.id, 'Elsewhere', bounds)!;
    const original = archimate.toXml();
    const originalSketch = sketch.toXml();

    // Not found: view, child, parent, a parent in another view, connection ids
    expect(archimate.moveDiagramObject('missing', 'id-db-object', null, bounds)).toBeNull();
    expect(archimate.moveDiagramObject(view, 'missing', null, bounds)).toBeNull();
    expect(archimate.moveDiagramObject(view, 'id-db-object', 'missing', bounds)).toBeNull();
    expect(archimate.moveDiagramObject(view, 'id-db-object', otherGroup.id, bounds)).toBeNull();
    expect(archimate.moveDiagramObject(view, 'id-api-to-db', null, bounds)).toBeNull();
    expect(archimate.moveDiagramObject(view, 'id-db-object', 'id-api-to-db', bounds)).toBeNull();
    // Not a container
    expect(archimate.moveDiagramObject(view, 'id-db-object', 'id-note', bounds)).toBeNull();
    expect(sketch.moveDiagramObject('id-canvas', 'id-image', 'id-canvas-sticky', bounds)).toBeNull();
    expect(sketch.moveDiagramObject('id-sketch', 'id-sticky', 'id-sketch-actor', bounds)).toBeNull();
    // Into itself or something nested in it
    expect(archimate.moveDiagramObject(view, 'id-portal-object', 'id-portal-object', bounds)).toBeNull();
    expect(archimate.moveDiagramObject(view, 'id-portal-object', 'id-api-object', bounds)).toBeNull();
    expect(archimate.moveDiagramObject(view, 'id-portal-object', 'id-deep-portal-object', bounds)).toBeNull();

    expect(archimate.toXml()).toBe(original);
    expect(sketch.toXml()).toBe(originalSketch);
  });

  it('should throw a RangeError for an index outside the parent’s other children, and change nothing', async () => {
    const archimate = await load(nestedDiagramObjects);
    const original = archimate.toXml();

    for (const index of [-1, 2, 1.5, Number.NaN]) {
      expect(() => archimate.moveDiagramObject(view, 'id-db-object', 'id-group', bounds, { index })).toThrow(RangeError);
    }
    // Within the same parent, the object itself doesn't count: four others, so 4 is the last valid index.
    expect(() => archimate.moveDiagramObject(view, 'id-note', null, bounds, { index: 5 })).toThrow(RangeError);
    expect(archimate.toXml()).toBe(original);
    expect(archimate.moveDiagramObject(view, 'id-note', null, bounds, { index: 4 })).toEqual({ parentId: null, index: 4 });
  });
});
