// Helpers shared by the test files.
import { readFile } from 'fs/promises';
import { XMLParser } from 'fast-xml-parser';
import { Archimate } from '../src/Archimate.mjs';
import type { Schema } from '../src/interfaces/schema/Schema.mjs';
import { archimateFromSchema } from '../src/internal/SchemaAccess.mjs';
import { toArray } from '../src/internal/Arrays.mjs';

/**
 * Loads .archimate text through the schema path, with fast-xml-parser's default options (which read text such as
 * `1.50` as a number), as a caller passing its own parsed schema would.
 */
export function parseXml(xml: string): Archimate {
  return archimateFromSchema(new XMLParser({ ignoreAttributes: false }).parse(xml) as Schema);
}

/**
 * `parseXml` on a file, after an optional edit of its text.
 */
export async function parseFile(path: string, edit: (xml: string) => string = xml => xml): Promise<Archimate> {
  return parseXml(edit(await readFile(path, 'utf8')));
}

/**
 * Loads a file as `Archimate.fromXml` does.
 */
export async function loadFile(path: string): Promise<Archimate> {
  return Archimate.fromXml(await readFile(path, 'utf8'));
}

/**
 * Every object in parsed or serialized XML that has an `@_id`, keyed by id.
 */
export function collectById(node: unknown, found = new Map<string, Record<string, unknown>>()): Map<string, Record<string, unknown>> {
  if (Array.isArray(node)) {
    node.forEach(item => collectById(item, found));
  } else if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (typeof record['@_id'] === 'string') found.set(record['@_id'], record);
    Object.values(record).forEach(value => collectById(value, found));
  }
  return found;
}

/**
 * The first item with the id at any depth of a tree, such as stored diagram children (`child => child.child`) or
 * those of `getView()` (`child => child.children`).
 */
export function findById<T extends { id: string }>(
  items: T | T[] | undefined,
  id: string,
  nested: (item: T) => T | T[] | undefined
): T | undefined {
  for (const item of toArray(items)) {
    const found = item.id === id ? item : findById(nested(item), id, nested);
    if (found) return found;
  }
  return undefined;
}

/**
 * The text of an .archimate file with the given content inside `<archimate:model>`.
 */
export function modelXml(content: string, { name = 'm', id = 'id-m' }: { name?: string; id?: string } = {}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="${name}" id="${id}" version="5.0.0">
${content}
</archimate:model>`;
}
