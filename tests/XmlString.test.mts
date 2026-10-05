import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFile } from 'fs/promises';
import { Archimate } from '../src/Archimate.mjs';
import { ArchimateParseError } from '../src/interfaces/ArchimateParseError.mjs';
import { ArchimateValidationError } from '../src/interfaces/ValidationIssue.mjs';
import type { Child } from '../src/interfaces/Child.mjs';
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

  it('keeps text that looks like a number or boolean as written', async () => {
    const archimate = Archimate.fromXml(await readFile('tests/fixtures/roundtrip/numeric-text.archimate', 'utf8'));
    const [subfolder] = archimate.getFolders('business');
    const [dmoCustomer, , note] = archimate.getView('id-view-numbers')!.children as unknown as Record<string, unknown>[];
    const [connection] = [dmoCustomer.sourceConnection].flat() as Record<string, unknown>[];

    expect(archimate.getPurpose()).toBe('1.0');
    expect(archimate.getFolder('business').documentation).toBe('007');
    expect(subfolder.documentation).toBe('2.0');
    expect(archimate.getElement('id-customer')?.documentation).toBe('1.50');
    expect(archimate.getElement('id-insurant')?.documentation).toBe('true');
    expect(archimate.getElement('id-policy')?.documentation).toBe('0x1A');
    expect(archimate.getElement('id-rel-assignment')?.documentation).toBe('1e3');
    expect(archimate.getView('id-view-numbers')?.documentation).toBe('10.0');
    expect(dmoCustomer.documentation).toBe('3.10');
    expect(connection.documentation).toBe('-0');
    expect(note.content).toBe('0.10');
  });

  it.each(['<archimate:model></archimate:model>', '<archimate:model>\n  </archimate:model>'])('loads an empty <archimate:model> element: %j', xml => {
    const archimate = Archimate.fromXml(xml);
    expect(archimate.listElements()).toEqual([]);
  });

  it('keeps leading and trailing whitespace in names, values and text', async () => {
    const archimate = Archimate.fromXml(await readFile('tests/fixtures/roundtrip/whitespace.archimate', 'utf8'));
    const [subfolder] = archimate.getFolders('business');
    const note = archimate.getView('id-view-ws')!.children![2] as unknown as Child;

    expect(archimate.getName()).toBe(' spaced model ');
    expect(archimate.getPurpose()).toBe(' purpose with spaces ');
    expect(archimate.getProperties()).toEqual(new Map([['Owner', '  EA  ']]));
    expect(archimate.getFolder('business')).toMatchObject({ name: 'Business ', documentation: '  indented first line\nsecond line  ' });
    expect(subfolder).toMatchObject({ name: ' Nested', documentation: '\nStarts and ends with a line break\n' });
    expect(archimate.getElement('id-customer')).toMatchObject({
      name: ' Customer ',
      documentation: 'Trailing spaces   ',
      properties: new Map([[' key ', ' 1.50 ']]),
    });
    expect(archimate.getElement('id-insurant')?.documentation).toBe('   ');
    expect(archimate.getRelationship('id-rel-assignment')?.name).toBe(' assigned ');
    expect(note.content).toBe('\n  Note with an indented line\n');
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

  it('writes a view built with the API, with grouped objects and connections, so that it loads again', () => {
    const archimate = new Archimate();
    const actor = archimate.upsertElement({ id: 'actor', name: 'Actor', type: 'BusinessActor' });
    const role = archimate.upsertElement({ id: 'role', name: 'Role', type: 'BusinessRole' });
    const service = archimate.upsertElement({ id: 'service', name: 'Service', type: 'BusinessService' });
    archimate.upsertRelationship({ id: 'assignment', type: 'AssignmentRelationship', source: actor.id, target: role.id });
    archimate.upsertRelationship({ id: 'serving', type: 'ServingRelationship', source: service.id, target: role.id });
    const view = archimate.createView('Built');
    const group = archimate.addGroup(view.id, 'Group', { x: 0, y: 0, width: 400, height: 300 })!;
    const inGroup = archimate.addDiagramObjectToGroup(view.id, group.id, actor.id, { x: 10, y: 10, width: 120, height: 55 })!;
    const roleObject = archimate.addDiagramObject(view.id, role.id, { x: 450, y: 10, width: 120, height: 55 })!;
    const serviceObject = archimate.addDiagramObject(view.id, service.id, { x: 450, y: 200, width: 120, height: 55 })!;
    const fromGroup = archimate.addConnection(view.id, inGroup.id, roleObject.id, 'assignment', { lineColor: '#ff0000' })!;
    const serving = archimate.addConnection(view.id, serviceObject.id, roleObject.id, 'serving')!;

    const xml = archimate.toXml();
    const reloaded = Archimate.fromXml(xml);
    const [groupChild, roleChild, serviceChild] = reloaded.getView(view.id)!.children as unknown as Child[];
    const [nested] = groupChild.child!;

    expect(reloaded.validateModel()).toEqual([]);
    expect(groupChild).toMatchObject({ id: group.id, type: 'Group', name: 'Group' });
    expect(nested).toMatchObject({ id: inGroup.id, type: 'DiagramObject', archimateElement: actor.id });
    expect(nested.sourceConnection).toMatchObject({
      id: fromGroup.id,
      source: inGroup.id,
      target: roleObject.id,
      archimateRelationship: 'assignment',
      lineColor: '#ff0000',
    });
    expect(serviceChild.sourceConnection).toMatchObject({ id: serving.id, archimateRelationship: 'serving' });
    // Archi stores the ids of the connections ending on an object in one space-separated attribute
    expect(roleChild.targetConnections).toBe(`${fromGroup.id} ${serving.id}`);
    expect(xml).not.toContain('targetConnections=""');
    expect(Archimate.fromXml(reloaded.toXml()).toXml()).toBe(reloaded.toXml());
  });

  it('omits an empty name, as Archi does', () => {
    const archimate = new Archimate();
    archimate.upsertElement({ id: 'a', name: 'A', type: 'BusinessActor' });
    archimate.upsertElement({ id: 'b', name: 'B', type: 'BusinessRole' });
    archimate.upsertElement({ id: 'x', name: 'Assigned', type: 'AssignmentRelationship', source: 'a', target: 'b' });
    archimate.updateElement('x', { name: '' });
    archimate.updateElement('b', { name: '' });

    const xml = archimate.toXml();
    expect(xml).toContain('<element xsi:type="archimate:AssignmentRelationship" id="x" source="a" target="b"/>');
    expect(xml).toContain('<element xsi:type="archimate:BusinessRole" id="b"/>');
    expect(xml).not.toMatch(/<element [^>]*name=""/);
  });

  it('loads an element without a name as an empty name', () => {
    const archimate = Archimate.fromXml(
      '<archimate:model xmlns:archimate="http://www.archimatetool.com/archimate" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" name="M" id="m">' +
        '<folder name="Business" id="f" type="business"><element xsi:type="archimate:BusinessActor" id="a"/></folder>' +
        '</archimate:model>'
    );
    expect(archimate.getElement('a')?.name).toBe('');
  });

  it('restores the original XML when a name set by updateElement is removed again', () => {
    const relationship = '<element xsi:type="archimate:AssignmentRelationship" id="x" source="a" target="b"/>';
    const archimate = new Archimate();
    archimate.upsertElement({ id: 'a', name: 'A', type: 'BusinessActor' });
    archimate.upsertElement({ id: 'b', name: 'B', type: 'BusinessRole' });
    archimate.upsertElement({ id: 'x', name: '', type: 'AssignmentRelationship', source: 'a', target: 'b' });
    archimate.updateElement('x', { documentation: 'Docs' });
    const original = archimate.toXml();
    expect(original).toContain('<documentation>Docs</documentation>');

    archimate.updateElement('x', { name: 'plays', documentation: undefined });
    expect(archimate.toXml()).not.toContain('<documentation>');
    archimate.updateElement('x', { name: undefined, documentation: 'Docs' });
    expect(archimate.toXml()).toBe(original);
    expect(archimate.toXml()).toContain(relationship.replace('/>', '>'));
  });

  it('omits an empty model name, as Archi does', () => {
    expect(new Archimate().toXml()).toMatch(/<archimate:model [^>]*id="[^"]+" version="5\.0\.0">/);
    expect(new Archimate().toXml()).not.toMatch(/<archimate:model [^>]*name=/);
  });

  it('keeps a model without a name unnamed on load and save', () => {
    const input =
      '<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'xmlns:archimate="http://www.archimatetool.com/archimate" id="m" version="5.0.0"/>';
    const archimate = Archimate.fromXml(input);
    expect(archimate.getName()).toBe('');
    expect(archimate.toXml()).not.toMatch(/<archimate:model [^>]*name=/);
  });

  it('writes the model name before its id when it is set', () => {
    const archimate = new Archimate();
    archimate.setName('Named');
    expect(archimate.toXml()).toMatch(/<archimate:model [^>]*name="Named" id="[^"]+" version="5\.0\.0">/);
  });
});
