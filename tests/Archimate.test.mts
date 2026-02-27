import { describe, it, beforeEach, expect, vi } from 'vitest';
import { Archimate } from '../src/Archimate.mjs';
import { folderType } from '../src/constants/archimate-mappings.mjs';
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
