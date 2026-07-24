import { describe, it, beforeEach, expect, vi } from 'vitest';
import { Archimate } from '../src/Archimate.mjs';
import {
  archimateModelTypes,
  folderType,
  isArchimateModelType,
  type ArchimateElementType,
  type ArchimateRelationshipType
} from '../src/constants/archimate-mappings.mjs';
import type { Model } from '../src/interfaces/Model.mjs';

vi.mock('../src/Parser.mjs', () => ({
  Parser: vi.fn().mockImplementation(function() {
    return {
      parse: vi.fn().mockReturnValue({ mockFolder: { elements: [] } })
    };
  })
}));

vi.mock('../src/Serializer.mjs', () => ({
  Serializer: vi.fn().mockImplementation(function() {
    return {
      serialize: vi.fn().mockReturnValue({ mockSerialized: true })
    };
  })
}));

describe('Archimate', () => {
  let archimate: Archimate;

  beforeEach(() => {
    archimate = new Archimate();
  });

  describe('init()', () => {
    it('should initialize model with all folder types', () => {
      const model = (archimate as any).model as Model;
      for (const [key, name] of folderType.entries()) {
        expect(model).toHaveProperty(key);
        expect(model[key].name).toBe(name);
        expect(Array.isArray(model[key].elements)).toBe(true);
      }
    });
  });

  describe('generateRandomId()', () => {
    it('should generate unique IDs starting with "id-" and length 35', () => {
      const id = archimate.generateRandomId();
      expect(id.startsWith('id-')).toBe(true);
      expect(id.length).toBe(35);
    });

    it('should detect existing IDs and generate unused IDs', () => {
      archimate.upsertElement({
        id: 'id-existing',
        name: 'Existing',
        type: 'ApplicationComponent'
      });

      const randomSpy = vi.spyOn(archimate, 'generateRandomId')
        .mockReturnValueOnce('id-existing')
        .mockReturnValueOnce('id-unique');

      expect(archimate.hasId('id-existing')).toBe(true);
      expect(archimate.hasId('id-missing')).toBe(false);
      expect(archimate.generateUniqueId()).toBe('id-unique');
      expect(randomSpy).toHaveBeenCalledTimes(2);

      randomSpy.mockRestore();
    });
  });

  describe('Archimate model type exports', () => {
    it('should expose supported model types and a type guard', () => {
      const elementType: ArchimateElementType = 'BusinessActor';
      const relationshipType: ArchimateRelationshipType = 'FlowRelationship';

      expect(archimateModelTypes).toContain(elementType);
      expect(archimateModelTypes).toContain(relationshipType);
      expect(isArchimateModelType(elementType)).toBe(true);
      expect(isArchimateModelType('NotARealType')).toBe(false);
    });
  });

  describe('upsertElement()', () => {

    it.each([
      {
        name: 'Add new element and update properties',
        initial: { name: 'Test App', type: 'ApplicationComponent', properties: new Map([['version', '1.0']]) },
        updates: [{ properties: new Map([['status', 'active']]) }],
        expected: { version: '1.0', status: 'active' }
      },
      {
        name: 'Merge properties and preserve id',
        initial: { id: 'fixed-id-123', name: 'Merge Test', type: 'ApplicationComponent', properties: new Map([['version', '1.0'], ['crown', 'gold']]) },
        updates: [{ properties: new Map([['status', 'planned'], ['version', '1.1']]) }],
        expected: { version: '1.1', status: 'planned', crown: 'gold' },
        expectedId: 'fixed-id-123'
      },
      {
        name: 'Add element without previous properties',
        initial: { name: 'No Props', type: 'ApplicationComponent' },
        updates: [{ properties: new Map([['newProp', 'value']]) }],
        expected: { newProp: 'value' }
      }
    ])('should upsert element correctly: $name', ({ initial, updates, expected, expectedId }) => {
      archimate.upsertElement(initial as any);
      updates.forEach(u => archimate.upsertElement({ ...initial, ...u } as any));

      const folderKey = 'application';
      const el = archimate.findElementInFolderByName(folderKey, initial.name);
      expect(el).toBeDefined();
      expect(el?.name).toBe(initial.name);
      expect(el?.type).toBe(initial.type);
      if (expectedId) expect(el?.id).toBe(expectedId);
      for (const [key, val] of Object.entries(expected)) {
        expect(el?.properties?.get(key)).toBe(val);
      }
    });

    it('should not add element if type is unknown', () => {
      expect(() => archimate.upsertElement({
        name: 'Unknown Type Test',
        type: 'NotARealType'
      } as any)).toThrowError('Unknown element type "NotARealType".');
    });

    it('should support documented BusinessActor elements', () => {
      archimate.upsertElement({
        id: 'business-actor-1',
        name: 'Documented Actor',
        type: 'BusinessActor'
      });

      const actor = archimate.findElementInFolderByName('business', 'Documented Actor');
      expect(actor?.id).toBe('business-actor-1');
      expect(actor?.type).toBe('BusinessActor');
    });

    it('should generate collision-safe IDs when adding elements without an ID', () => {
      archimate.upsertElement({
        id: 'id-existing',
        name: 'Existing',
        type: 'ApplicationComponent'
      });
      const randomSpy = vi.spyOn(archimate, 'generateRandomId')
        .mockReturnValueOnce('id-existing')
        .mockReturnValueOnce('id-generated-element');

      archimate.upsertElement({
        name: 'Generated ID Element',
        type: 'ApplicationComponent'
      });

      expect(archimate.findElementInFolderByName('application', 'Generated ID Element')?.id).toBe('id-generated-element');
      randomSpy.mockRestore();
    });

  });

  describe('findElementInFolderByName()', () => {
    it('should return null if element does not exist', () => {
      expect(archimate.findElementInFolderByName('application', 'DoesNotExist')).toBeNull();
    });

    it('should return the matching element if found', () => {
      archimate.upsertElement({
        name: 'Lookup Test',
        type: 'ApplicationComponent'
      });
      const found = archimate.findElementInFolderByName('application', 'Lookup Test');
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Lookup Test');
    });
  });

  describe('element lookup, update, and delete APIs', () => {
    beforeEach(() => {
      archimate.upsertElement({
        id: 'app-a',
        name: 'App A',
        type: 'ApplicationComponent',
        properties: new Map([['version', '1.0']])
      });
      archimate.upsertElement({
        id: 'app-b',
        name: 'App B',
        type: 'ApplicationComponent'
      });
      archimate.upsertElement({
        id: 'rel-a-b',
        name: 'A to B',
        type: 'FlowRelationship',
        source: 'app-a',
        target: 'app-b'
      });
    });

    it('should get an element by ID from any folder', () => {
      expect(archimate.getElement('app-a')?.name).toBe('App A');
      expect(archimate.getElement('rel-a-b')?.type).toBe('FlowRelationship');
      expect(archimate.getElement('missing')).toBeNull();
    });

    it('should find elements by name across folders', () => {
      archimate.upsertElement({
        id: 'business-app-a',
        name: 'App A',
        type: 'BusinessActor'
      });

      const matches = archimate.findElementsByName('App A');
      expect(matches.map(el => el.id)).toEqual(expect.arrayContaining(['app-a', 'business-app-a']));
    });

    it('should update an element by ID and merge properties', () => {
      const updated = archimate.updateElement('app-a', {
        name: 'App A Updated',
        documentation: 'Updated documentation',
        properties: new Map([['status', 'active']])
      });

      expect(updated?.id).toBe('app-a');
      expect(updated?.name).toBe('App A Updated');
      expect(updated?.documentation).toBe('Updated documentation');
      expect(updated?.properties?.get('version')).toBe('1.0');
      expect(updated?.properties?.get('status')).toBe('active');
      expect(archimate.updateElement('missing', { name: 'No-op' })).toBeNull();
    });

    it('should move an element when its type changes folder', () => {
      const updated = archimate.updateElement('app-a', {
        type: 'BusinessActor'
      });

      expect(updated?.type).toBe('BusinessActor');
      expect(archimate.findElementInFolderByName('application', 'App A')).toBeNull();
      expect(archimate.findElementInFolderByName('business', 'App A')?.id).toBe('app-a');
    });

    it('should reject updates to unknown element types', () => {
      expect(() => archimate.updateElement('app-a', {
        type: 'NotARealType'
      })).toThrowError('Unknown element type "NotARealType".');
    });

    it('should delete elements and clean relationships and view references', () => {
      const view = archimate.createView('Deletion View');
      const sourceObject = archimate.addDiagramObject(view.id, 'app-a', {
        x: 0,
        y: 0,
        width: 100,
        height: 50
      });
      const targetObject = archimate.addDiagramObject(view.id, 'app-b', {
        x: 200,
        y: 0,
        width: 100,
        height: 50
      });
      archimate.addConnection(view.id, sourceObject!.id, targetObject!.id, 'rel-a-b');

      expect(archimate.deleteElement('app-a')).toBe(true);

      expect(archimate.getElement('app-a')).toBeNull();
      expect(archimate.getElement('rel-a-b')).toBeNull();

      const updatedView = archimate.getView(view.id);
      const children = updatedView?.children as any[];
      expect(children.some(child => child.archimateElement === 'app-a')).toBe(false);
      expect(children.find(child => child.archimateElement === 'app-b')?.targetConnections).toEqual([]);
      expect(archimate.deleteElement('missing')).toBe(false);
    });

    it('should delete relationships and clean matching view connections', () => {
      const view = archimate.createView('Relationship Deletion View');
      const sourceObject = archimate.addDiagramObject(view.id, 'app-a', {
        x: 0,
        y: 0,
        width: 100,
        height: 50
      });
      const targetObject = archimate.addDiagramObject(view.id, 'app-b', {
        x: 200,
        y: 0,
        width: 100,
        height: 50
      });
      archimate.addConnection(view.id, sourceObject!.id, targetObject!.id, 'rel-a-b');

      expect(archimate.deleteElement('rel-a-b')).toBe(true);

      const updatedView = archimate.getView(view.id);
      const children = updatedView?.children as any[];
      expect(children.find(child => child.archimateElement === 'app-a')?.sourceConnections).toEqual([]);
      expect(children.find(child => child.archimateElement === 'app-b')?.targetConnections).toEqual([]);
    });
  });

  describe('relationship APIs', () => {
    beforeEach(() => {
      archimate.upsertElement({
        id: 'rel-app-a',
        name: 'Relationship App A',
        type: 'ApplicationComponent'
      });
      archimate.upsertElement({
        id: 'rel-app-b',
        name: 'Relationship App B',
        type: 'ApplicationComponent'
      });
      archimate.upsertElement({
        id: 'rel-app-c',
        name: 'Relationship App C',
        type: 'ApplicationComponent'
      });
    });

    it('should create and retrieve relationships with required endpoints', () => {
      const relationship = archimate.upsertRelationship({
        id: 'formal-rel-a-b',
        name: 'Formal A to B',
        type: 'FlowRelationship',
        source: 'rel-app-a',
        target: 'rel-app-b',
        properties: new Map([['kind', 'data']])
      });

      expect(relationship.id).toBe('formal-rel-a-b');
      expect(relationship.source).toBe('rel-app-a');
      expect(relationship.target).toBe('rel-app-b');
      expect(relationship.properties?.get('kind')).toBe('data');
      expect(archimate.getRelationship('formal-rel-a-b')?.name).toBe('Formal A to B');
      expect(archimate.getRelationship('missing')).toBeNull();
    });

    it('should generate collision-safe IDs when adding relationships without an ID', () => {
      archimate.upsertRelationship({
        id: 'id-existing-relationship',
        name: 'Existing Relationship',
        type: 'FlowRelationship',
        source: 'rel-app-a',
        target: 'rel-app-b'
      });
      const randomSpy = vi.spyOn(archimate, 'generateRandomId')
        .mockReturnValueOnce('id-existing-relationship')
        .mockReturnValueOnce('id-generated-relationship');

      const relationship = archimate.upsertRelationship({
        name: 'Generated Relationship',
        type: 'ServingRelationship',
        source: 'rel-app-a',
        target: 'rel-app-c'
      });

      expect(relationship.id).toBe('id-generated-relationship');
      randomSpy.mockRestore();
    });

    it('should update relationships by id and merge properties', () => {
      archimate.upsertRelationship({
        id: 'formal-rel-a-b',
        name: 'Formal A to B',
        type: 'FlowRelationship',
        source: 'rel-app-a',
        target: 'rel-app-b',
        properties: new Map([['kind', 'data']])
      });

      const updated = archimate.upsertRelationship({
        id: 'formal-rel-a-b',
        name: 'Formal A to B Updated',
        type: 'FlowRelationship',
        source: 'rel-app-a',
        target: 'rel-app-b',
        properties: new Map([['status', 'active']])
      });

      expect(updated.name).toBe('Formal A to B Updated');
      expect(updated.properties?.get('kind')).toBe('data');
      expect(updated.properties?.get('status')).toBe('active');
      expect(archimate.findRelationshipsBetween('rel-app-a', 'rel-app-b')).toHaveLength(1);
    });

    it('should find relationships for elements and between elements', () => {
      archimate.upsertRelationship({
        id: 'formal-rel-a-b',
        name: 'Formal A to B',
        type: 'FlowRelationship',
        source: 'rel-app-a',
        target: 'rel-app-b'
      });
      archimate.upsertRelationship({
        id: 'formal-rel-b-a',
        name: 'Formal B to A',
        type: 'TriggeringRelationship',
        source: 'rel-app-b',
        target: 'rel-app-a'
      });
      archimate.upsertRelationship({
        id: 'formal-rel-a-c',
        name: 'Formal A to C',
        type: 'ServingRelationship',
        source: 'rel-app-a',
        target: 'rel-app-c'
      });

      expect(archimate.findRelationshipsForElement('rel-app-a').map(rel => rel.id)).toEqual(
        expect.arrayContaining(['formal-rel-a-b', 'formal-rel-b-a', 'formal-rel-a-c'])
      );
      expect(archimate.findRelationshipsForElement('rel-app-a', 'source').map(rel => rel.id)).toEqual(
        expect.arrayContaining(['formal-rel-a-b', 'formal-rel-a-c'])
      );
      expect(archimate.findRelationshipsForElement('rel-app-a', 'target').map(rel => rel.id)).toEqual(['formal-rel-b-a']);
      expect(archimate.findRelationshipsBetween('rel-app-a', 'rel-app-b').map(rel => rel.id)).toEqual(['formal-rel-a-b']);
      expect(archimate.findRelationshipsBetween('rel-app-a', 'rel-app-b', { bidirectional: true }).map(rel => rel.id)).toEqual(
        expect.arrayContaining(['formal-rel-a-b', 'formal-rel-b-a'])
      );
      expect(archimate.findRelationshipsBetween('rel-app-a', 'rel-app-b', { bidirectional: true, type: 'FlowRelationship' }).map(rel => rel.id)).toEqual(['formal-rel-a-b']);
    });

    it('should reject invalid relationship types and missing endpoints', () => {
      expect(() => archimate.upsertRelationship({
        name: 'Invalid Type',
        type: 'ApplicationComponent' as any,
        source: 'rel-app-a',
        target: 'rel-app-b'
      })).toThrowError('Unknown relationship type "ApplicationComponent".');

      expect(() => archimate.upsertRelationship({
        name: 'Missing Endpoint',
        type: 'FlowRelationship',
        source: 'rel-app-a',
        target: 'missing-target'
      })).toThrowError('Relationship target element "missing-target" not found in model.');
    });

    it('should delete relationships and clean view connections', () => {
      const relationship = archimate.upsertRelationship({
        id: 'formal-rel-a-b',
        name: 'Formal A to B',
        type: 'FlowRelationship',
        source: 'rel-app-a',
        target: 'rel-app-b'
      });
      const view = archimate.createView('Formal Relationship View');
      const sourceObject = archimate.addDiagramObject(view.id, 'rel-app-a', {
        x: 0,
        y: 0,
        width: 100,
        height: 50
      });
      const targetObject = archimate.addDiagramObject(view.id, 'rel-app-b', {
        x: 200,
        y: 0,
        width: 100,
        height: 50
      });
      archimate.addConnection(view.id, sourceObject!.id, targetObject!.id, relationship.id);

      expect(archimate.deleteRelationship(relationship.id)).toBe(true);
      expect(archimate.deleteRelationship('missing')).toBe(false);
      expect(archimate.getRelationship(relationship.id)).toBeNull();

      const updatedView = archimate.getView(view.id);
      const children = updatedView?.children as any[];
      expect(children.find(child => child.archimateElement === 'rel-app-a')?.sourceConnections).toEqual([]);
      expect(children.find(child => child.archimateElement === 'rel-app-b')?.targetConnections).toEqual([]);
    });
  });

  describe('view ID generation', () => {
    it('should generate collision-safe IDs for views and diagram children', () => {
      archimate.upsertElement({
        id: 'app-for-view',
        name: 'App for View',
        type: 'ApplicationComponent'
      });
      const randomSpy = vi.spyOn(archimate, 'generateRandomId')
        .mockReturnValueOnce('app-for-view')
        .mockReturnValueOnce('generated-view-id')
        .mockReturnValueOnce('app-for-view')
        .mockReturnValueOnce('generated-object-id');

      const view = archimate.createView('Generated IDs View');
      const object = archimate.addDiagramObject(view.id, 'app-for-view', {
        x: 0,
        y: 0,
        width: 100,
        height: 50
      });

      expect(view.id).toBe('generated-view-id');
      expect(object?.id).toBe('generated-object-id');
      expect(archimate.hasId('generated-view-id')).toBe(true);
      expect(archimate.hasId('generated-object-id')).toBe(true);
      randomSpy.mockRestore();
    });
  });

  describe('validateModel()', () => {
    it('should return no issues for a valid model with view connections', () => {
      archimate.upsertElement({
        id: 'valid-app-a',
        name: 'Valid App A',
        type: 'ApplicationComponent'
      });
      archimate.upsertElement({
        id: 'valid-app-b',
        name: 'Valid App B',
        type: 'ApplicationComponent'
      });
      archimate.upsertElement({
        id: 'valid-rel-a-b',
        name: 'Valid Relationship',
        type: 'FlowRelationship',
        source: 'valid-app-a',
        target: 'valid-app-b'
      });

      const view = archimate.createView('Valid View');
      const sourceObject = archimate.addDiagramObject(view.id, 'valid-app-a', {
        x: 0,
        y: 0,
        width: 100,
        height: 50
      });
      const targetObject = archimate.addDiagramObject(view.id, 'valid-app-b', {
        x: 200,
        y: 0,
        width: 100,
        height: 50
      });
      archimate.addConnection(view.id, sourceObject!.id, targetObject!.id, 'valid-rel-a-b');

      expect(archimate.validateModel()).toEqual([]);
      expect(() => archimate.assertValidModel()).not.toThrow();
    });

    it('should report duplicate IDs, unknown types, and broken references', () => {
      const model = (archimate as any).model as Model;
      model.application.elements = [
        {
          id: 'duplicate-id',
          name: 'Duplicate One',
          type: 'ApplicationComponent'
        },
        {
          id: 'duplicate-id',
          name: 'Duplicate Two',
          type: 'ApplicationComponent'
        },
        {
          id: 'unknown-type',
          name: 'Unknown Type',
          type: 'NotARealType'
        } as any
      ];
      model.relations.elements = [
        {
          id: 'broken-rel',
          name: 'Broken Relationship',
          type: 'FlowRelationship',
          source: 'missing-source',
          target: 'missing-target'
        }
      ];
      model.diagrams.elements = [
        {
          id: 'broken-view',
          name: 'Broken View',
          type: 'ArchimateDiagramModel',
          child: [
            {
              id: 'view-source',
              type: 'DiagramObject',
              archimateElement: 'missing-element',
              bounds: { x: 0, y: 0, width: 100, height: 50 },
              sourceConnections: [
                {
                  id: 'broken-connection',
                  type: 'Connection',
                  source: 'view-source',
                  target: 'missing-target-object',
                  archimateRelationship: 'missing-relationship'
                }
              ]
            } as any,
            {
              id: 'view-target',
              type: 'DiagramObject',
              archimateElement: 'duplicate-id',
              targetConnections: ['missing-connection'],
              bounds: { x: 200, y: 0, width: 100, height: 50 }
            } as any
          ]
        }
      ];

      const issueCodes = archimate.validateModel().map(issue => issue.code);

      expect(issueCodes).toEqual(expect.arrayContaining([
        'duplicate-id',
        'unknown-type',
        'relationship-missing-source',
        'relationship-missing-target',
        'diagram-object-missing-element',
        'view-connection-missing-relationship',
        'view-connection-missing-target',
        'view-target-connection-missing-source'
      ]));
      expect(() => archimate.assertValidModel()).toThrow('Archimate model validation failed');
    });
  });

  describe('parse()', () => {
    it('should set model and name from parsed schema', () => {
      const input: any = { 'archimate:model': { '@_name': 'Parsed Model' } };
      archimate.parse(input);
      expect((archimate as any).name).toBe('Parsed Model');
    });

    it('should default name to "Unnamed Model" if not provided', () => {
      const input: any = {};
      archimate.parse(input);
      expect((archimate as any).name).toBe('Unnamed Model');
    });
  });

  describe('serialize()', () => {
    it('should call serializer and return serialized schema', () => {
      const result = archimate.serialize();
      expect(result).toEqual({ mockSerialized: true });
    });
  });

});
