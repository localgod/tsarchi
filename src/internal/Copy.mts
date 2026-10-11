/**
 * A deep copy of model data: plain objects, arrays, Maps and primitives, which is all the model holds. Used instead of
 * `structuredClone`, which some JavaScript engines (QuickJS) do not have.
 */
export function deepCopy<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) return value.map(deepCopy) as T;
  if (value instanceof Map) return new Map(Array.from(value, ([key, item]) => [key, deepCopy(item)])) as T;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    // Assigning `__proto__` would set the prototype; define it as a plain property, as structuredClone does
    if (key === '__proto__')
      Object.defineProperty(result, key, { value: deepCopy(item), enumerable: true, writable: true, configurable: true });
    else result[key] = deepCopy(item);
  }
  return result as T;
}
