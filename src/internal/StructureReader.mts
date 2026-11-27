// Checks shared by the readers of snapshots and of the JSON format: they read untrusted data and report where it is
// not in the expected shape, as `<path>: <message>`.

/** An error in the shape of data being read; the message starts with the path of the value. */
export class StructureError extends Error {}

export function fail(path: string, message: string): never {
  throw new StructureError(`${path}: ${message}`);
}

/** Whether a value is an object made by a literal or JSON.parse, not an array, a Map or a class instance. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** A plain object with no keys besides `keys`. */
export function readObject(value: unknown, path: string, keys: ReadonlySet<string>): Record<string, unknown> {
  if (!isPlainObject(value)) fail(path, 'expected an object');
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) fail(path, `unexpected key '${key}'`);
  }
  return value;
}

export function readArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'expected an array');
  return value;
}
