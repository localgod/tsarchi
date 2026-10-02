import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFile } from 'fs/promises';
import { Archimate } from '../src/Archimate.mjs';
import { ArchimateParseError } from '../src/interfaces/ArchimateParseError.mjs';
import { ArchimateValidationError } from '../src/interfaces/ValidationIssue.mjs';
import { Parser } from '../src/internal/Parser.mjs';
import { compareObjects, listRoundtripFixtures, normalizeXml } from './roundtrip-utils.mjs';

function parseError(text: string): ArchimateParseError {
  try {
    Archimate.fromXml(text);
  } catch (error) {
    expect(error).toBeInstanceOf(ArchimateParseError);
    return error as ArchimateParseError;
  }
  throw new Error('Expected Archimate.fromXml to throw');
}

describe('Archimate.fromXml / toXml', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('round-trips every roundtrip fixture through strings', async () => {
    for (const fixture of await listRoundtripFixtures()) {
      const input = await readFile(fixture, 'utf8');
      const output = Archimate.fromXml(input).toXml();
      expect(compareObjects(normalizeXml(input), normalizeXml(output)), fixture).toEqual([]);
    }
  });

  it('loads the model content', async () => {
    const archimate = Archimate.fromXml(await readFile('tests/fixtures/roundtrip/minimal.archimate', 'utf8'));
    expect(archimate.getName()).toBeTruthy();
    expect(archimate.getId()).toBeTruthy();
  });

  it('loads an empty <archimate:model> element', () => {
    const archimate = Archimate.fromXml('<archimate:model></archimate:model>');
    expect(archimate.listElements()).toEqual([]);
  });

  it('reports text that is not XML as not-xml, with its position', () => {
    const error = parseError('<archimate:model name="x">\n  <folder>\n</archimate:model>');
    expect(error.kind).toBe('not-xml');
    expect(error.line).toBe(3);
    expect(error.column).toBeGreaterThan(0);
    expect(error.message).toContain('line 3');
  });

  it('accepts a byte order mark or whitespace before the XML declaration', () => {
    const archimate = Archimate.fromXml('\uFEFF\n  <?xml version="1.0" encoding="UTF-8"?>\n<archimate:model name="Spaced"/>');
    expect(archimate.getName()).toBe('Spaced');
  });

  it('counts skipped leading lines in the reported position', () => {
    expect(parseError('\n\n<archimate:model>\n<folder>\n</archimate:model>').line).toBe(5);
  });

  it('reports XML without an <archimate:model> root as not-archimate', () => {
    expect(parseError('<model name="x"/>').kind).toBe('not-archimate');
    expect(parseError('').kind).toBe('not-xml');
  });

  it('reports an <archimate:model> root holding text as invalid-structure', () => {
    expect(parseError('<archimate:model>hello</archimate:model>').kind).toBe('invalid-structure');
  });

  it('reports a failure while reading the model as invalid-structure, keeping the cause', () => {
    const cause = new TypeError('boom');
    vi.spyOn(Parser.prototype, 'parse').mockImplementation(() => {
      throw cause;
    });

    const error = parseError('<archimate:model name="x"/>');
    expect(error.kind).toBe('invalid-structure');
    expect(error.message).toContain('boom');
    expect(error.cause).toBe(cause);
  });

  it('validates the model before writing it', () => {
    const archimate = new Archimate();
    archimate.upsertElement({ id: 'app-1', name: 'App 1', type: 'ApplicationComponent' });
    archimate.upsertElement({ id: 'rel', name: 'Rel', type: 'FlowRelationship', source: 'app-1', target: 'missing' });

    expect(() => archimate.toXml()).toThrow(ArchimateValidationError);
  });

  it('writes a new model that loads again', () => {
    const archimate = new Archimate();
    archimate.upsertElement({ id: 'app-1', name: 'App 1', type: 'ApplicationComponent' });

    const reloaded = Archimate.fromXml(archimate.toXml());
    expect(reloaded.listElements().map(element => element.id)).toEqual(['app-1']);
  });
});
