import type { Property } from '../interfaces/Property.mjs';
import type { Property as SchemaProperty } from '../interfaces/schema/Property.mjs';
import { toArray } from './Arrays.mjs';

/**
 * A property with only the fields that are set, so a missing key or value stays missing.
 */
export function toProperty(key: string | undefined, value: string | undefined): Property {
  const property: Property = {};
  if (key !== undefined) property.key = key;
  if (value !== undefined) property.value = value;
  return property;
}

/**
 * Copies a list of properties, keeping only `key` and `value`.
 */
export function copyProperties(properties: readonly Property[]): Property[] {
  return properties.map(({ key, value }) => toProperty(key, value));
}

/**
 * Reads `<property>` elements as an ordered list, repeated keys included.
 */
export function schemaToProperties(property: SchemaProperty | SchemaProperty[] | undefined): Property[] {
  return toArray(property)
    .filter(Boolean)
    .map(p => toProperty(p['@_key'], p['@_value']));
}

/**
 * Reads `<property>` elements, or undefined when there are none.
 */
export function schemaToOptionalProperties(property: SchemaProperty | SchemaProperty[] | undefined): Property[] | undefined {
  const properties = schemaToProperties(property);
  return properties.length > 0 ? properties : undefined;
}

/**
 * The `<property>` elements to write, or undefined when there are none.
 */
export function propertiesToSchema(properties: readonly Property[] | undefined): SchemaProperty[] | undefined {
  if (!properties || properties.length === 0) return undefined;
  return properties.map(({ key, value }) => ({ '@_key': key, '@_value': value }) as SchemaProperty);
}
