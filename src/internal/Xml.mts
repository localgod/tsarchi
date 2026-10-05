import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';
import type { X2jOptions, XmlBuilderOptions } from 'fast-xml-parser';
import { ArchimateParseError } from '../interfaces/ArchimateParseError.mjs';
import type { Schema } from '../interfaces/schema/Schema.mjs';

const parseOptions: Partial<X2jOptions> = {
  ignoreAttributes: false,
  allowBooleanAttributes: true,
  // Text such as documentation stays as written: "1.50" is not read as the number 1.5.
  parseTagValue: false,
  // Archi keeps leading and trailing whitespace in names, values and text; removeIndentation drops the formatting.
  trimValues: false,
};

const buildOptions: XmlBuilderOptions = {
  ignoreAttributes: false,
  format: true,
  suppressEmptyNode: true,
  suppressBooleanAttributes: false,
};

/**
 * Removes the whitespace that indents child elements, which fast-xml-parser keeps as `#text` when `trimValues` is
 * off. In Archi's format, an element with attributes or child elements never holds text, so whitespace-only text in
 * one is formatting. The text of an element without attributes, such as `<documentation>`, is a string and is kept
 * as written.
 */
export function removeIndentation(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(removeIndentation);
  } else if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (typeof record['#text'] === 'string' && record['#text'].trim() === '') delete record['#text'];
    Object.values(record).forEach(removeIndentation);
  }
}

/**
 * Parses the text of an .archimate file into its schema shape.
 * Throws an ArchimateParseError when the text is not XML or has no `<archimate:model>` root.
 */
export function parseArchimateXml(input: string): Schema {
  // A byte order mark or whitespace before the XML declaration makes the XML invalid, but is harmless
  const leading = /^\uFEFF?\s*/.exec(input)?.[0] ?? '';
  const text = input.slice(leading.length);
  const skippedLines = leading.split('\n').length - 1;

  const result = XMLValidator.validate(text);
  if (result !== true) {
    const { msg, col } = result.err;
    const line = result.err.line + skippedLines;
    throw new ArchimateParseError('not-xml', `Not well-formed XML at line ${line}, column ${col}: ${msg}`, { line, column: col });
  }

  const parsed = new XMLParser(parseOptions).parse(text) as Record<string, unknown>;
  removeIndentation(parsed);
  if (!parsed || !('archimate:model' in parsed)) {
    throw new ArchimateParseError('not-archimate', 'Not an Archi model: the XML has no <archimate:model> root element.');
  }

  const model = parsed['archimate:model'];
  if (Array.isArray(model)) {
    throw new ArchimateParseError('invalid-structure', 'The XML has more than one <archimate:model> element.');
  }
  // An empty <archimate:model></archimate:model> parses to an empty (or whitespace-only) string
  if (typeof model === 'string' && model.trim() === '') {
    parsed['archimate:model'] = {};
  } else if (typeof model !== 'object' || model === null) {
    throw new ArchimateParseError('invalid-structure', 'The <archimate:model> element holds text instead of folders.');
  }

  return parsed as unknown as Schema;
}

/**
 * Writes a model in its schema shape as .archimate XML text.
 */
export function buildArchimateXml(schema: object): string {
  return new XMLBuilder(buildOptions).build(schema);
}
