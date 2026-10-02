import { describe, it, beforeEach, expect, vi } from 'vitest';
import { Archimate } from '../src/Archimate.mjs';
import {
  archimateModelTypes,
  archimateRelationshipAliasTypes,
  archimateRelationshipTypes,
  elementTypeToFolderKey,
  folderType,
  isArchimateModelType,
  type ArchimateElementType,
  type ArchimateRelationshipType
} from '../src/constants/archimate-mappings.mjs';
import { relationshipMatrixKeys, relationshipsMatrix } from '../src/constants/relationships-matrix.mjs';
import type { Model } from '../src/interfaces/Model.mjs';
import type { Relationship, RelationshipInput } from '../src/interfaces/Relationship.mjs';

vi.mock('../src/internal/Parser.mjs', () => ({
  Parser: vi.fn().mockImplementation(function() {
    return {
      parse: vi.fn().mockReturnValue({ mockFolder: { elements: [] } }),
      parseModelContent: vi.fn().mockReturnValue({})
    };
  })
}));

vi.mock('../src/internal/Serializer.mjs', () => ({
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
    it.each(['Location', 'Grouping'] as const)('should place %s in the other folder', (type) => {
      archimate.upsertElement({ id: `other-${type}`, name: type, type });

      expect(archimateModelTypes).toContain(type);
      expect(isArchimateModelType(type)).toBe(true);
      expect(((archimate as any).model as Model).other.elements).toEqual([
        expect.objectContaining({ id: `other-${type}`, type })
      ]);
      expect(archimate.validateModel()).toEqual([]);
    });

    it.each([
      ['ApplicationEvent', 'application'],
      ['Equipment', 'technology'],
      ['Product', 'business'],
      ['Material', 'technology'],
    ] as const)('should place %s in the %s folder', (type, folderKey) => {
      archimate.upsertElement({ id: `el-${type}`, name: type, type });

      expect(isArchimateModelType(type)).toBe(true);
      expect(((archimate as any).model as Model)[folderKey].elements).toEqual([
        expect.objectContaining({ id: `el-${type}`, type })
      ]);
      expect(archimate.validateModel()).toEqual([]);
    });

    it.each(['Stage', 'Actor', 'BusinessProduct', 'TechnologyObject'])('should not accept %s, which Archi does not have', (type) => {
      expect(isArchimateModelType(type)).toBe(false);
      expect(() => archimate.upsertElement({ id: 'el', name: type, type: type as ArchimateElementType })).toThrow();
    });

    it('should list exactly the element types in Archi\'s relationships matrix', () => {
      const elementTypes = [...elementTypeToFolderKey]
        .filter(([, folderKey]) => folderKey !== 'relations' && folderKey !== 'diagrams')
        .map(([type]) => type);

      expect(elementTypes.sort()).toEqual(Object.keys(relationshipsMatrix).filter(type => type !== 'Relationship').sort());
    });

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

    it('should add unnamed junctions with different ids as separate elements', () => {
      archimate.upsertElement({ id: 'j1', name: '', type: 'Junction', junctionType: 'or' });
      archimate.upsertElement({ id: 'j2', name: '', type: 'Junction' });

      expect(archimate.getElement('j1')?.junctionType).toBe('or');
      expect(archimate.getElement('j2')).not.toBeNull();
      expect(archimate.getElement('j2')?.junctionType).toBeUndefined();
    });

    it('should add unnamed elements without an id as separate elements', () => {
      archimate.upsertElement({ name: '', type: 'Junction' });
      archimate.upsertElement({ name: '', type: 'Junction' });

      expect(archimate.findElementsByType('Junction')).toHaveLength(2);
    });

    it('should match on id when one is given', () => {
      archimate.upsertElement({ id: 'app-1', name: 'App', type: 'ApplicationComponent' });
      archimate.upsertElement({ id: 'app-2', name: 'App', type: 'ApplicationComponent' });
      archimate.upsertElement({ id: 'app-1', name: 'Renamed', type: 'ApplicationComponent' });

      expect(archimate.getElement('app-1')?.name).toBe('Renamed');
      expect(archimate.getElement('app-2')?.name).toBe('App');
      expect(archimate.findElementsByType('ApplicationComponent')).toHaveLength(2);
    });

    it('should throw when the id is used by something else', () => {
      archimate.upsertElement({ id: 'shared-id', name: 'Actor', type: 'BusinessActor' });

      expect(() => archimate.upsertElement({ id: 'shared-id', name: 'App', type: 'ApplicationComponent' }))
        .toThrowError('ID "shared-id" is already in use.');
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

    it('should create and update the access type of access relationships', () => {
      archimate.upsertElement({ id: 'rel-data', name: 'Data', type: 'DataObject' });
      archimate.upsertRelationship({ id: 'access-a-b', name: 'reads', type: 'AccessRelationship', source: 'rel-app-a', target: 'rel-data', accessType: 1 });
      expect(archimate.getRelationship('access-a-b')?.accessType).toBe(1);

      archimate.upsertRelationship({ id: 'access-a-b', name: 'reads', type: 'AccessRelationship', source: 'rel-app-a', target: 'rel-data', accessType: 3 });
      expect(archimate.getRelationship('access-a-b')?.accessType).toBe(3);
    });

    it('should accept junctions as relationship endpoints', () => {
      archimate.upsertElement({ id: 'rel-junction', name: 'Junction', type: 'Junction' });
      archimate.upsertRelationship({ id: 'rel-a-j', name: 'A to J', type: 'FlowRelationship', source: 'rel-app-a', target: 'rel-junction' });
      archimate.upsertRelationship({ id: 'rel-j-b', name: 'J to B', type: 'FlowRelationship', source: 'rel-junction', target: 'rel-app-b' });

      expect(((archimate as any).model as Model).other.elements).toEqual([expect.objectContaining({ id: 'rel-junction' })]);
      expect(archimate.getRelationship('rel-junction')).toBeNull();
      expect(archimate.validateModel()).toEqual([]);
    });

    it('should accept relationships as relationship endpoints', () => {
      archimate.upsertRelationship({ id: 'rel-a-b', type: 'CompositionRelationship', source: 'rel-app-a', target: 'rel-app-b' });
      archimate.upsertRelationship({ id: 'rel-c-ab', type: 'AssociationRelationship', source: 'rel-app-c', target: 'rel-a-b' });
      archimate.upsertRelationship({ id: 'rel-cab-a', type: 'AssociationRelationship', source: 'rel-c-ab', target: 'rel-app-a' });

      expect(archimate.getRelationship('rel-c-ab')?.target).toBe('rel-a-b');
      expect(archimate.getRelationship('rel-cab-a')?.source).toBe('rel-c-ab');
      expect(archimate.validateModel()).toEqual([]);
    });

    it('should allow aggregation and composition from a grouping, location or plateau to a relationship', () => {
      archimate.upsertRelationship({ id: 'rel-a-b', type: 'FlowRelationship', source: 'rel-app-a', target: 'rel-app-b' });
      archimate.upsertElement({ id: 'rel-grouping', name: 'Grouping', type: 'Grouping' });
      archimate.upsertElement({ id: 'rel-location', name: 'Location', type: 'Location' });
      archimate.upsertElement({ id: 'rel-plateau', name: 'Plateau', type: 'Plateau' });

      archimate.upsertRelationship({ id: 'rel-g-ab', type: 'AggregationRelationship', source: 'rel-grouping', target: 'rel-a-b' });
      archimate.upsertRelationship({ id: 'rel-l-ab', type: 'CompositionRelationship', source: 'rel-location', target: 'rel-a-b' });
      archimate.upsertRelationship({ id: 'rel-p-ab', type: 'Aggregation', source: 'rel-plateau', target: 'rel-a-b' });

      expect(archimate.validateModel()).toEqual([]);
    });

    it.each([
      ['a non-association from an element to a relationship', 'AggregationRelationship', 'rel-app-c', 'rel-a-b'],
      ['a non-association from a relationship to an element', 'FlowRelationship', 'rel-a-b', 'rel-app-c'],
      ['an association between two relationships', 'AssociationRelationship', 'rel-a-b', 'rel-b-c'],
      ['an association from a junction to a relationship', 'AssociationRelationship', 'rel-junction', 'rel-a-b'],
      ['an association from a relationship to a junction', 'AssociationRelationship', 'rel-a-b', 'rel-junction'],
      ['an association from a relationship to its own source', 'AssociationRelationship', 'rel-a-b', 'rel-app-a'],
      ['an association from an element to a relationship it connects', 'AssociationRelationship', 'rel-app-b', 'rel-a-b'],
    ])('should reject %s', (_label, type, source, target) => {
      archimate.upsertRelationship({ id: 'rel-a-b', type: 'FlowRelationship', source: 'rel-app-a', target: 'rel-app-b' });
      archimate.upsertRelationship({ id: 'rel-b-c', type: 'FlowRelationship', source: 'rel-app-b', target: 'rel-app-c' });
      archimate.upsertElement({ id: 'rel-junction', name: 'Junction', type: 'Junction' });

      expect(() => archimate.upsertRelationship({ id: 'rel-new', type: type as RelationshipInput['type'], source, target }))
        .toThrowError(/Relationship "rel-new"/);
      expect(archimate.getRelationship('rel-new')).toBeNull();

      ((archimate as any).model as Model).relations.elements!.push({ id: 'rel-new', type, source, target } as Relationship);
      expect(archimate.validateModel()).toEqual([
        expect.objectContaining({ code: 'relationship-endpoint-not-allowed', id: 'rel-new' }),
      ]);
    });

    it('should accept relationship types that Archi\'s matrix allows between two elements', () => {
      archimate.upsertElement({ id: 'rel-service', name: 'Service', type: 'ApplicationService' });
      archimate.upsertElement({ id: 'rel-process', name: 'Process', type: 'BusinessProcess' });

      archimate.upsertRelationship({ id: 'rel-serving', type: 'ServingRelationship', source: 'rel-service', target: 'rel-process' });
      archimate.upsertRelationship({ id: 'rel-flow', type: 'Flow', source: 'rel-service', target: 'rel-process' });

      expect(archimate.validateModel()).toEqual([]);
    });

    it.each([
      ['an assignment between two application components', 'AssignmentRelationship', 'rel-app-a', 'rel-app-b'],
      ['an access between two application components', 'AccessRelationship', 'rel-app-a', 'rel-app-b'],
      ['an influence between two application components', 'InfluenceRelationship', 'rel-app-a', 'rel-app-b'],
    ])('should reject %s', (_label, type, source, target) => {
      expect(() => archimate.upsertRelationship({ id: 'rel-new', type: type as RelationshipInput['type'], source, target }))
        .toThrowError(`Relationship "rel-new" of type ${type} is not allowed from ApplicationComponent "rel-app-a" to ApplicationComponent "rel-app-b".`);
      expect(archimate.getRelationship('rel-new')).toBeNull();

      ((archimate as any).model as Model).relations.elements!.push({ id: 'rel-new', type, source, target } as Relationship);
      expect(archimate.validateModel()).toEqual([
        expect.objectContaining({ code: 'relationship-type-not-allowed', severity: 'warning', id: 'rel-new' }),
      ]);
      expect(() => archimate.assertValidModel()).not.toThrow();
    });

    it('should reject a short-named type the matrix does not allow, reporting the full type', () => {
      expect(() => archimate.upsertRelationship({ id: 'rel-new', type: 'Influence', source: 'rel-app-a', target: 'rel-app-b' }))
        .toThrowError('Relationship "rel-new" of type InfluenceRelationship is not allowed from ApplicationComponent "rel-app-a" to ApplicationComponent "rel-app-b".');
    });

    it.each(archimateRelationshipAliasTypes)('should store the short name %s as the full relationship type', (alias) => {
      // Grouping to Grouping allows every relationship type.
      archimate.upsertElement({ id: 'rel-grouping-a', name: 'Grouping A', type: 'Grouping' });
      archimate.upsertElement({ id: 'rel-grouping-b', name: 'Grouping B', type: 'Grouping' });

      const relationship = archimate.upsertRelationship({ id: 'rel-alias', type: alias, source: 'rel-grouping-a', target: 'rel-grouping-b' });

      expect(relationship.type).toBe(`${alias}Relationship`);
      expect(archimate.getRelationship('rel-alias')?.type).toBe(`${alias}Relationship`);
      expect(archimate.findRelationshipsBetween('rel-grouping-a', 'rel-grouping-b', { type: alias }).map(rel => rel.id)).toEqual(['rel-alias']);
      expect(archimate.validateModel()).toEqual([]);
    });

    it('should match an existing relationship by its full type when given a short name', () => {
      archimate.upsertRelationship({ name: 'Flow', type: 'FlowRelationship', source: 'rel-app-a', target: 'rel-app-b' });
      archimate.upsertRelationship({ name: 'Flow', type: 'Flow', source: 'rel-app-a', target: 'rel-app-b', documentation: 'updated' });

      expect(archimate.findRelationshipsBetween('rel-app-a', 'rel-app-b')).toEqual([
        expect.objectContaining({ type: 'FlowRelationship', documentation: 'updated' }),
      ]);
    });

    it.each(['UsedByRelationship', 'RepresentationRelationship', 'MaterialRelationship', 'UsedBy', 'Flow'])(
      'should not accept %s as a stored relationship type, as Archi does not write it', (type) => {
        expect(isArchimateModelType(type)).toBe(false);
        expect(archimateModelTypes).not.toContain(type);

        ((archimate as any).model as Model).relations.elements!.push({ id: 'rel-legacy', name: 'Legacy', type, source: 'rel-app-a', target: 'rel-app-b' } as unknown as Relationship);
        expect(archimate.validateModel()).toEqual([
          expect.objectContaining({ code: 'unknown-type', severity: 'error', id: 'rel-legacy' }),
        ]);
      });

    it.each(['UsedByRelationship', 'RepresentationRelationship', 'MaterialRelationship', 'UsedBy'])(
      'should reject %s in upsertRelationship()', (type) => {
        expect(() => archimate.upsertRelationship({ id: 'rel-new', type: type as RelationshipInput['type'], source: 'rel-app-a', target: 'rel-app-b' }))
          .toThrowError(`Unknown relationship type "${type}".`);
      });

    it('should list exactly the relationship types in Archi\'s relationships matrix', () => {
      expect([...archimateRelationshipTypes].sort()).toEqual(Object.values(relationshipMatrixKeys).sort());
    });

    describe('junctions', () => {
      beforeEach(() => {
        archimate.upsertElement({ id: 'j-actor', name: 'Actor', type: 'BusinessActor' });
        archimate.upsertElement({ id: 'j-role', name: 'Role', type: 'BusinessRole' });
        archimate.upsertElement({ id: 'j-junction', name: 'Junction', type: 'Junction' });
        archimate.upsertElement({ id: 'j-grouping', name: 'Grouping', type: 'Grouping' });
      });

      it('should reject a relationship whose type differs from the other relationships on a junction', () => {
        archimate.upsertRelationship({ id: 'j-in', type: 'FlowRelationship', source: 'rel-app-a', target: 'j-junction' });

        expect(() => archimate.upsertRelationship({ id: 'j-out', type: 'TriggeringRelationship', source: 'j-junction', target: 'rel-app-b' }))
          .toThrowError('all relationships on a Junction must have the same type');
        expect(() => archimate.upsertRelationship({ id: 'j-in-2', type: 'ServingRelationship', source: 'rel-app-c', target: 'j-junction' }))
          .toThrowError('all relationships on a Junction must have the same type');
        archimate.upsertRelationship({ id: 'j-out', type: 'Flow', source: 'j-junction', target: 'rel-app-b' });

        ((archimate as any).model as Model).relations.elements!.push(
          { id: 'j-bad', type: 'TriggeringRelationship', source: 'j-junction', target: 'rel-app-c' } as Relationship
        );
        expect(archimate.validateModel()).toEqual([
          expect.objectContaining({ code: 'junction-relationship-type-mismatch', severity: 'warning', id: 'j-in' }),
          expect.objectContaining({ code: 'junction-relationship-type-mismatch', severity: 'warning', id: 'j-out' }),
          expect.objectContaining({ code: 'junction-relationship-type-mismatch', severity: 'warning', id: 'j-bad' }),
        ]);
      });

      it('should let a relationship on a junction change type when it is the only one', () => {
        archimate.upsertRelationship({ id: 'j-in', type: 'FlowRelationship', source: 'rel-app-a', target: 'j-junction' });
        archimate.upsertRelationship({ id: 'j-in', type: 'TriggeringRelationship', source: 'rel-app-a', target: 'j-junction' });

        expect(archimate.getRelationship('j-in')?.type).toBe('TriggeringRelationship');
        expect(archimate.validateModel()).toEqual([]);
      });

      it('should reject a relationship that is not allowed between the concepts a junction links', () => {
        archimate.upsertRelationship({ id: 'j-in', type: 'RealizationRelationship', source: 'j-actor', target: 'j-junction' });

        expect(() => archimate.upsertRelationship({ id: 'j-out', type: 'RealizationRelationship', source: 'j-junction', target: 'j-role' }))
          .toThrowError('Relationship "j-out" of type RealizationRelationship is not allowed from BusinessActor "j-actor" to BusinessRole "j-role" through Junction "j-junction".');

        ((archimate as any).model as Model).relations.elements!.push(
          { id: 'j-out', type: 'RealizationRelationship', source: 'j-junction', target: 'j-role' } as Relationship
        );
        expect(archimate.validateModel()).toEqual([
          expect.objectContaining({ code: 'relationship-type-not-allowed', id: 'j-in' }),
          expect.objectContaining({ code: 'relationship-type-not-allowed', id: 'j-out' }),
        ]);
      });

      it('should accept a relationship that is allowed between the concepts a junction links', () => {
        archimate.upsertRelationship({ id: 'j-in', type: 'AssignmentRelationship', source: 'j-actor', target: 'j-junction' });
        archimate.upsertRelationship({ id: 'j-out', type: 'AssignmentRelationship', source: 'j-junction', target: 'j-role' });

        expect(archimate.validateModel()).toEqual([]);
      });

      it('should let a grouping or location aggregate or compose a junction whatever its other relationships', () => {
        archimate.upsertElement({ id: 'j-location', name: 'Location', type: 'Location' });
        archimate.upsertRelationship({ id: 'j-in', type: 'FlowRelationship', source: 'rel-app-a', target: 'j-junction' });
        archimate.upsertRelationship({ id: 'j-group', type: 'AggregationRelationship', source: 'j-grouping', target: 'j-junction' });
        archimate.upsertRelationship({ id: 'j-location-in', type: 'Composition', source: 'j-location', target: 'j-junction' });
        archimate.upsertRelationship({ id: 'j-out', type: 'FlowRelationship', source: 'j-junction', target: 'rel-app-b' });

        expect(archimate.validateModel()).toEqual([]);
        expect(() => archimate.upsertRelationship({ id: 'j-group-flow', type: 'FlowRelationship', source: 'j-grouping', target: 'j-junction' }))
          .not.toThrow();
        expect(() => archimate.upsertRelationship({ id: 'j-group-serving', type: 'ServingRelationship', source: 'j-grouping', target: 'j-junction' }))
          .toThrowError('all relationships on a Junction must have the same type');
      });
    });

    it('should reject a relationship that targets itself', () => {
      archimate.upsertRelationship({ id: 'rel-a-b', type: 'AssociationRelationship', source: 'rel-app-a', target: 'rel-app-b' });

      expect(() => archimate.upsertRelationship({ id: 'rel-a-b', type: 'AssociationRelationship', source: 'rel-app-a', target: 'rel-a-b' }))
        .toThrowError('cannot connect to itself');
    });

    it('should reject views as relationship endpoints', () => {
      const view = archimate.createView('Endpoint View');

      expect(() => archimate.upsertRelationship({
        type: 'AssociationRelationship',
        source: 'rel-app-a',
        target: view.id
      })).toThrowError(`Relationship target element "${view.id}" not found in model.`);
    });

    it('should delete relationships connected to a deleted relationship', () => {
      archimate.upsertRelationship({ id: 'rel-a-b', type: 'CompositionRelationship', source: 'rel-app-a', target: 'rel-app-b' });
      archimate.upsertRelationship({ id: 'rel-c-ab', type: 'AssociationRelationship', source: 'rel-app-c', target: 'rel-a-b' });
      archimate.upsertRelationship({ id: 'rel-cab-a', type: 'AssociationRelationship', source: 'rel-c-ab', target: 'rel-app-a' });
      archimate.upsertRelationship({ id: 'rel-b-c', type: 'FlowRelationship', source: 'rel-app-b', target: 'rel-app-c' });

      expect(archimate.deleteRelationship('rel-a-b')).toBe(true);

      expect(archimate.getRelationship('rel-c-ab')).toBeNull();
      expect(archimate.getRelationship('rel-cab-a')).toBeNull();
      expect(archimate.getRelationship('rel-b-c')).not.toBeNull();
      expect(archimate.validateModel()).toEqual([]);
    });

    it('should delete relationships attached to relationships of a deleted element', () => {
      archimate.upsertRelationship({ id: 'rel-a-b', type: 'CompositionRelationship', source: 'rel-app-a', target: 'rel-app-b' });
      archimate.upsertRelationship({ id: 'rel-c-ab', type: 'AssociationRelationship', source: 'rel-app-c', target: 'rel-a-b' });

      expect(archimate.deleteElement('rel-app-a')).toBe(true);

      expect(archimate.getRelationship('rel-a-b')).toBeNull();
      expect(archimate.getRelationship('rel-c-ab')).toBeNull();
      expect(archimate.validateModel()).toEqual([]);
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

    it('should not require names on relationships or junctions', () => {
      archimate.upsertElement({ id: 'unnamed-app-a', name: 'App A', type: 'ApplicationComponent' });
      archimate.upsertElement({ id: 'unnamed-app-b', name: 'App B', type: 'ApplicationComponent' });
      const model = (archimate as any).model as Model;
      model.other.elements = [{ id: 'unnamed-junction', type: 'Junction' } as any];
      model.relations.elements = [
        { id: 'unnamed-rel', type: 'FlowRelationship', source: 'unnamed-app-a', target: 'unnamed-junction' } as any,
        { id: 'unnamed-rel-2', type: 'FlowRelationship', source: 'unnamed-junction', target: 'unnamed-app-b' } as any
      ];

      expect(archimate.validateModel()).toEqual([]);
    });

    it('should report missing-name for unnamed elements as a warning that does not block saving', () => {
      const model = (archimate as any).model as Model;
      model.application.elements = [{ id: 'unnamed-app', type: 'ApplicationComponent' } as any];

      expect(archimate.validateModel()).toEqual([
        expect.objectContaining({ code: 'missing-name', severity: 'warning', id: 'unnamed-app' })
      ]);
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
      expect(archimate.validateModel().every(issue => issue.severity === 'error')).toBe(true);
      expect(() => archimate.assertValidModel()).toThrow('Archimate model validation failed');
    });

    it('should throw only the errors from assertValidModel', () => {
      const model = (archimate as any).model as Model;
      model.application.elements = [{ id: 'unnamed-app', type: 'ApplicationComponent' } as any];
      model.relations.elements = [{ id: 'broken-rel', type: 'FlowRelationship', source: 'unnamed-app', target: 'missing' } as any];

      expect(() => archimate.assertValidModel()).toThrow(expect.objectContaining({
        issues: [expect.objectContaining({ code: 'relationship-missing-target', severity: 'error' })],
      }));
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
