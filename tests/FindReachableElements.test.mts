import { describe, it, expect, beforeEach } from 'vite-plus/test';
import { Archimate } from '../src/Archimate.mjs';
import { TraversalDirection } from '../src/constants/archi-codes.mjs';
import { ArchimateType } from '../src/constants/archimate-mappings.mjs';

const ids = (archimate: Archimate, ...args: Parameters<Archimate['findReachableElements']>) =>
  archimate.findReachableElements(...args).map(element => element.id);

describe('findReachableElements', () => {
  let archimate: Archimate;

  // a → b → c → d (flow), e → a (serving), note — association → the a → b relationship, x unconnected
  beforeEach(() => {
    archimate = new Archimate();
    for (const id of ['a', 'b', 'c', 'd', 'e', 'x']) {
      archimate.upsertElement({ id, name: id.toUpperCase(), type: ArchimateType.ApplicationComponent });
    }
    archimate.upsertElement({ id: 'note', name: 'Note', type: ArchimateType.BusinessObject });
    archimate.upsertRelationship({ id: 'ab', type: ArchimateType.FlowRelationship, source: 'a', target: 'b' });
    archimate.upsertRelationship({ id: 'bc', type: ArchimateType.FlowRelationship, source: 'b', target: 'c' });
    archimate.upsertRelationship({ id: 'cd', type: ArchimateType.FlowRelationship, source: 'c', target: 'd' });
    archimate.upsertRelationship({ id: 'ea', type: ArchimateType.ServingRelationship, source: 'e', target: 'a' });
    archimate.upsertRelationship({ id: 'note-ab', type: ArchimateType.AssociationRelationship, source: 'note', target: 'ab' });
  });

  it('should return the start first, then the others by distance, each once', () => {
    expect(ids(archimate, 'a', 0)).toEqual(['a']);
    expect(ids(archimate, 'a', 1)).toEqual(['a', 'b', 'e']);
    expect(ids(archimate, 'a', 2)).toEqual(['a', 'b', 'e', 'c']);
    expect(ids(archimate, 'a', Infinity)).toEqual(['a', 'b', 'e', 'c', 'd']);
    expect(ids(archimate, 'x', Infinity)).toEqual(['x']);
  });

  it('should visit each element once in a cycle', () => {
    archimate.upsertRelationship({ id: 'da', type: ArchimateType.FlowRelationship, source: 'd', target: 'a' });

    expect(ids(archimate, 'a', Infinity, { direction: TraversalDirection.Outgoing })).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(archimate, 'a', 1)).toEqual(['a', 'b', 'e', 'd']);
  });

  it('should follow relationships in the given direction', () => {
    expect(ids(archimate, 'b', Infinity, { direction: TraversalDirection.Outgoing })).toEqual(['b', 'c', 'd']);
    expect(ids(archimate, 'b', Infinity, { direction: TraversalDirection.Incoming })).toEqual(['b', 'a', 'e']);
    expect(ids(archimate, 'b', 1, { direction: TraversalDirection.Both })).toEqual(['b', 'a', 'c']);
  });

  it('should only follow relationships of the given types', () => {
    expect(ids(archimate, 'a', Infinity, { relationshipTypes: [ArchimateType.FlowRelationship] })).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(archimate, 'a', Infinity, { relationshipTypes: [ArchimateType.ServingRelationship] })).toEqual(['a', 'e']);
    expect(ids(archimate, 'a', Infinity, { relationshipTypes: [] })).toEqual(['a']);
  });

  it('should not follow relationships that end on a relationship', () => {
    expect(ids(archimate, 'note', Infinity)).toEqual(['note']);
    expect(ids(archimate, 'a', Infinity)).not.toContain('note');
  });

  it('should return copies', () => {
    const [start] = archimate.findReachableElements('a', 0);
    start.name = 'Changed';

    expect(archimate.getElement('a')!.name).toBe('A');
  });

  it('should throw on an unknown start or a start that is a relationship or view', () => {
    const view = archimate.createView('View');

    expect(() => archimate.findReachableElements('missing', 1)).toThrowError('Element with ID missing not found in model');
    expect(() => archimate.findReachableElements('ab', 1)).toThrowError(
      'Element ab has type FlowRelationship, which is not an element type'
    );
    expect(() => archimate.findReachableElements(view.id, 1)).toThrowError(
      `Element ${view.id} has type ArchimateDiagramModel, which is not an element type`
    );
  });

  it('should throw on an invalid hops', () => {
    for (const hops of [-1, 1.5, NaN, -Infinity]) {
      expect(() => archimate.findReachableElements('a', hops)).toThrowError(`Invalid hops ${JSON.stringify(hops)};`);
    }
    expect(() => archimate.findReachableElements('a', '2' as any)).toThrowError('Invalid hops "2";');
  });

  it('should throw on an unknown direction or relationship type', () => {
    expect(() => archimate.findReachableElements('a', 1, { direction: 'source' as any })).toThrowError(
      'Unknown direction "source"; expected one of "outgoing", "incoming", "both".'
    );
    expect(() => archimate.findReachableElements('a', 1, { relationshipTypes: ['Flow' as any] })).toThrowError(
      'Unknown relationship type "Flow".'
    );
    expect(() => archimate.findReachableElements('a', 1, { relationshipTypes: [ArchimateType.ApplicationComponent as any] })).toThrowError(
      'Unknown relationship type "ApplicationComponent".'
    );
    expect(() => archimate.findReachableElements('a', 1, { relationshipTypes: ArchimateType.FlowRelationship as any })).toThrowError(
      'relationshipTypes must be an array of relationship types.'
    );
  });
});
