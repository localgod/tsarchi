/**
 * Normalizes a repeatable value to an array. fast-xml-parser reads a single child element as an object and several
 * as an array; a missing (or empty) value becomes an empty array.
 */
export function toArray<T>(value: T | T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}
