import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';
import type { X2jOptions, XmlBuilderOptions } from 'fast-xml-parser';
import { ArchimateParseError } from '../interfaces/ArchimateParseError.mjs';
import type { Schema } from '../interfaces/schema/Schema.mjs';

const predefinedEntities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/**
 * Replaces the predefined entities and numeric character references (`&#xD;`, `&#13;`) in one pass, so that
 * `&amp;#xD;` stays the text `&#xD;`. Other references are left as they are.
 */
function decodeReferences(raw: string): string {
  return raw.replace(/&(?:#x([0-9a-fA-F]+)|#([0-9]+)|(amp|lt|gt|quot|apos));/g, (reference, hex, decimal, name) => {
    if (name) return predefinedEntities[name];
    const codePoint = hex ? parseInt(hex, 16) : Number(decimal);
    return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : reference;
  });
}

/**
 * Reads values as an XML parser such as Archi's does, which fast-xml-parser leaves to its caller: a literal line
 * break in text is `\n`, literal whitespace in an attribute value is a space, and character references give the
 * character itself. Archi writes a carriage return in text as `&#xD;` and tabs and line breaks in attribute values as
 * `&#x9;`, `&#xA;` and `&#xD;` (EMF's `XMLSaveImpl.Escape`).
 */
export const xmlValueOptions = {
  processEntities: false,
  tagValueProcessor: (_name: string, value: string) => decodeReferences(value.replace(/\r\n?/g, '\n')),
  attributeValueProcessor: (_name: string, value: string) => decodeReferences(value.replace(/\r\n|[\t\n\r]/g, ' ')),
} satisfies Partial<X2jOptions>;

const parseOptions: Partial<X2jOptions> = {
  ...xmlValueOptions,
  ignoreAttributes: false,
  allowBooleanAttributes: true,
  // Text such as documentation stays as written: "1.50" is not read as the number 1.5.
  parseTagValue: false,
  // Archi keeps leading and trailing whitespace in names, values and text; removeIndentation drops the formatting.
  trimValues: false,
};

const escapedCharacters: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&apos;',
  '"': '&quot;',
  '\t': '&#x9;',
  '\n': '&#xA;',
  '\r': '&#xD;',
};
const escape = (value: string, characters: RegExp) => value.replace(characters, character => escapedCharacters[character]);

const buildOptions: XmlBuilderOptions = {
  // Values are escaped as Archi reads them back: a carriage return in text, and tabs and line breaks in attribute
  // values, would otherwise be read as a line break or a space.
  processEntities: false,
  tagValueProcessor: (_name: string, value: unknown) => escape(String(value), /[&<>'"\r]/g),
  attributeValueProcessor: (_name: string, value: unknown) => escape(String(value), /[&<>'"\t\n\r]/g),
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
