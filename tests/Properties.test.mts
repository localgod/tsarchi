import { describe, expect, it } from 'vite-plus/test';
import { addProperty, getProperty, getPropertyKeys, getPropertyValues, removeProperty, setProperty } from '../src/Properties.mjs';
import type { Property } from '../src/interfaces/Property.mjs';

const list: Property[] = [
  { key: 'tag', value: 'one' },
  { key: 'owner', value: 'sales' },
  { key: 'tag', value: 'two' },
  { key: 'empty' },
  { value: 'no key' },
];

describe('property helpers', () => {
  it('reads the first value of a key, or all of them', () => {
    expect(getProperty(list, 'tag')).toBe('one');
    expect(getPropertyValues(list, 'tag')).toEqual(['one', 'two']);
    expect(getProperty(list, 'missing')).toBeUndefined();
    expect(getPropertyValues(list, 'missing')).toEqual([]);
    expect(getProperty(undefined, 'tag')).toBeUndefined();
  });

  it('treats a missing key or value as an empty string, as Archi does', () => {
    expect(getProperty(list, 'empty')).toBe('');
    expect(getProperty(list, '')).toBe('no key');
    expect(getPropertyKeys(list)).toEqual(['tag', 'owner', 'empty', '']);
  });

  it('sets every entry of a key, or adds the key at the end', () => {
    expect(setProperty(list, 'tag', 'x').map(p => p.value)).toEqual(['x', 'sales', 'x', undefined, 'no key']);
    expect(setProperty(list, 'new', 'y').at(-1)).toEqual({ key: 'new', value: 'y' });
    expect(setProperty(undefined, 'new', 'y')).toEqual([{ key: 'new', value: 'y' }]);
  });

  it('adds a property even when the key is already there', () => {
    expect(getPropertyValues(addProperty(list, 'tag', 'three'), 'tag')).toEqual(['one', 'two', 'three']);
  });

  it('removes every entry of a key, or only those with the given value', () => {
    expect(getPropertyKeys(removeProperty(list, 'tag'))).toEqual(['owner', 'empty', '']);
    expect(getPropertyValues(removeProperty(list, 'tag', 'one'), 'tag')).toEqual(['two']);
    expect(removeProperty(list, 'empty', '')).toHaveLength(4);
  });

  it('returns new lists and leaves the given one unchanged', () => {
    const before = JSON.stringify(list);
    const changed = setProperty(list, 'owner', 'x');
    changed[0].value = 'changed';
    addProperty(list, 'a', 'b')[0].value = 'changed';
    removeProperty(list, 'owner')[0].value = 'changed';

    expect(JSON.stringify(list)).toBe(before);
  });
});
