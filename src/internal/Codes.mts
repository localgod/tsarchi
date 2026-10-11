/**
 * Throws when a value is not one of the values of a code object such as `TextAlignment`, naming the allowed values.
 */
export function assertCode(name: string, value: unknown, codes: Readonly<Record<string, string | number>>): void {
  const allowed: unknown[] = Object.values(codes);
  if (!allowed.includes(value)) {
    throw new Error(`Unknown ${name} ${JSON.stringify(value)}; expected one of ${allowed.map(code => JSON.stringify(code)).join(', ')}.`);
  }
}

/**
 * As `assertCode`, for an option that may be left out.
 */
export function assertOptionalCode(name: string, value: unknown, codes: Readonly<Record<string, string | number>>): void {
  if (value !== undefined) assertCode(name, value, codes);
}
