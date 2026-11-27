import type { Property } from './interfaces/Property.mjs';

// Helpers for the `properties` list of a model, folder, element, relationship, view, diagram child or view
// connection. A key may appear more than once, as Archi allows. The helpers follow jArchi's `prop()` and
// `removeProp()`, and treat a missing key or value as "", Archi's default. Those that change a list return a new one:
// pass it to `updateElement`, `updateFolder` or `setProperties`.

const keyOf = (property: Property): string => property.key ?? '';

/**
 * The value of the first property with this key, or undefined when there is none.
 */
export function getProperty(properties: readonly Property[] | undefined, key: string): string | undefined {
  const property = properties?.find(p => keyOf(p) === key);
  return property && (property.value ?? '');
}

/**
 * The values of every property with this key, in order.
 */
export function getPropertyValues(properties: readonly Property[] | undefined, key: string): string[] {
  return (properties ?? []).filter(p => keyOf(p) === key).map(p => p.value ?? '');
}

/**
 * The keys of the properties, each once, in the order they first appear.
 */
export function getPropertyKeys(properties: readonly Property[] | undefined): string[] {
  return Array.from(new Set((properties ?? []).map(keyOf)));
}

/**
 * A copy of the list with every property of this key set to the value, or with the property added at the end when the
 * key is not there yet.
 */
export function setProperty(properties: readonly Property[] | undefined, key: string, value: string): Property[] {
  const list = properties ?? [];
  if (!list.some(p => keyOf(p) === key)) return addProperty(list, key, value);
  return list.map(p => (keyOf(p) === key ? { key, value } : { ...p }));
}

/**
 * A copy of the list with the property added at the end, even when the key is already there.
 */
export function addProperty(properties: readonly Property[] | undefined, key: string, value: string): Property[] {
  return [...(properties ?? []).map(p => ({ ...p })), { key, value }];
}

/**
 * A copy of the list without the properties of this key, or only those of this key that have the given value.
 */
export function removeProperty(properties: readonly Property[] | undefined, key: string, value?: string): Property[] {
  return (properties ?? []).filter(p => keyOf(p) !== key || (value !== undefined && (p.value ?? '') !== value)).map(p => ({ ...p }));
}
