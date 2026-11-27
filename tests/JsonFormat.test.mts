import { describe, expect, it } from 'vite-plus/test';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';
import Ajv2020Module from 'ajv/dist/2020.js';
import { Archimate } from '../src/Archimate.mjs';
import { modelJsonSchema } from '../src/constants/model-json-schema.mjs';
import { AccessType, GroupBorderType, NoteBorderType, TextAlignment } from '../src/constants/archi-codes.mjs';
import type { ModelJson } from '../src/interfaces/ModelJson.mjs';
import type { Child } from '../src/interfaces/Child.mjs';
import { modelXml } from './helpers.mjs';

// ajv is CommonJS: its class is the default export in Node and the module itself when bundled.
type Ajv = typeof import('ajv/dist/2020.js').default;
const Ajv2020: Ajv = (Ajv2020Module as unknown as { default?: Ajv }).default ?? (Ajv2020Module as unknown as Ajv);
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(modelJsonSchema);

const roundtripDir = 'tests/fixtures/roundtrip';
const goldenDir = 'tests/fixtures/json';
const fixtures = (dir: string) =>
  readdirSync(dir)
    .filter(name => name.endsWith('.archimate'))
    .map(name => `${dir}/${name}`);
const allFixtures = [...fixtures(roundtripDir), ...fixtures('tests/fixtures/archi')];
const load = (path: string) => Archimate.fromXml(readFileSync(path, 'utf8'));

describe('toJson and fromJson on every fixture', () => {
  it.each(allFixtures)('%s: gives the same model back and the same JSON again, valid against the schema', path => {
    const model = load(path);
    const json = model.toJson();
    const back = Archimate.fromJson(json);

    // The snapshot is canonical: equal snapshots mean toXml() writes the same text, also for models that do not validate.
    expect(JSON.stringify(back.snapshot())).toBe(JSON.stringify(model.snapshot()));
    expect(back.toJson()).toBe(json);
    expect(validate(JSON.parse(json)), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it.each(fixtures(roundtripDir))('%s: writes the same .archimate text from its JSON', path => {
    const model = load(path);
    expect(Archimate.fromJson(model.toJson()).toXml()).toBe(model.toXml());
  });

  // Set UPDATE_JSON_FIXTURES=1 to write the files after a deliberate change to the format.
  it.each(fixtures(roundtripDir))('%s: matches its committed JSON', path => {
    const golden = `${goldenDir}/${basename(path, '.archimate')}.json`;
    const json = load(path).toJson();
    if (process.env.UPDATE_JSON_FIXTURES || !existsSync(golden)) {
      mkdirSync(goldenDir, { recursive: true });
      writeFileSync(golden, json);
    }
    expect(json).toBe(readFileSync(golden, 'utf8'));
  });
});

describe('the JSON text', () => {
  const model = () => {
    const archimate = Archimate.fromXml(
      modelXml(`<folder name="Business" id="id-business" type="business">
    <element xsi:type="archimate:BusinessActor" name="Zoë" id="id-z"/>
    <element xsi:type="archimate:BusinessActor" name="Åse" id="id-a"/>
  </folder>`)
    );
    return archimate;
  };

  it('has two-space indentation, one value per line and a final line break', () => {
    const json = model().toJson();
    expect(json.endsWith('}\n')).toBe(true);
    expect(json).toContain('\n  "formatVersion": 1,\n');
    expect(json).toContain('"members": [\n        "id-z",\n        "id-a"\n      ]');
  });

  it('sorts concepts by id, keeps folder members in file order, and puts the id first', () => {
    const json = JSON.parse(model().toJson()) as ModelJson;
    expect(json.elements.map(element => element.id)).toEqual(['id-a', 'id-z']);
    expect(json.folders[1].members).toEqual(['id-z', 'id-a']);
    expect(Object.keys(json.elements[0])[0]).toBe('id');
    expect(Object.keys(json.folders[1]).slice(0, 2)).toEqual(['id', 'type']);
  });

  it('writes non-ASCII characters as they are', () => {
    expect(model().toJson()).toContain('"name": "Zoë"');
  });

  it('writes no export time or tool version', () => {
    expect(Object.keys(JSON.parse(model().toJson()))).toEqual([
      'formatVersion',
      'model',
      'folders',
      'elements',
      'relationships',
      'views',
      'extensions',
    ]);
  });
});

describe('codes', () => {
  function modelWithCodes(): Archimate {
    const archimate = new Archimate();
    const a = archimate.upsertElement({ id: 'id-a', name: 'A', type: 'ApplicationComponent' });
    const d = archimate.upsertElement({ id: 'id-d', name: 'D', type: 'DataObject' });
    archimate.upsertRelationship({
      id: 'id-r',
      name: '',
      type: 'AccessRelationship',
      source: a.id,
      target: d.id,
      accessType: AccessType.Read,
    });
    const view = archimate.createView('V');
    const bounds = { x: 0, y: 0, width: 10, height: 10 };
    const children: Child[] = [
      { id: 'id-g', type: 'Group', bounds, borderType: GroupBorderType.Rectangle, textAlignment: TextAlignment.Left },
      { id: 'id-n', type: 'Note', bounds, borderType: NoteBorderType.DogEar, textAlignment: 7 },
      { id: 'id-o', type: 'DiagramObject', archimateElement: 'id-a', bounds, figure: 1 },
    ];
    archimate.updateElement(view.id, { child: children });
    return archimate;
  }

  it('names the codes Archi defines, by the type of the diagram child, and keeps unknown ones as numbers', () => {
    const json = JSON.parse(modelWithCodes().toJson()) as ModelJson;
    expect(json.relationships[0].accessType).toBe('read');
    const [group, note, object] = json.views[0].children!;
    expect([group.borderType, group.textAlignment]).toEqual(['rectangle', 'left']);
    expect([note.borderType, note.textAlignment]).toEqual(['dogEar', 7]);
    expect(object.figure).toBe('alternate');
  });

  it('reads the names back as the codes', () => {
    const model = modelWithCodes();
    expect(JSON.stringify(Archimate.fromJson(model.toJson()).snapshot())).toBe(JSON.stringify(model.snapshot()));
  });

  it('rejects a name the field does not have', () => {
    const json = JSON.parse(modelWithCodes().toJson()) as ModelJson;
    json.relationships[0].accessType = 'sideways' as never;
    expect(() => Archimate.fromJson(JSON.stringify(json))).toThrowError(/accessType: unknown name "sideways"/);
  });
});

describe('models the format cannot give back', () => {
  const business = (content: string) => modelXml(`<folder name="Business" id="id-business" type="business">${content}</folder>`);

  it('throws for a concept without an id', () => {
    const archimate = Archimate.fromXml(business('<element xsi:type="archimate:BusinessActor" name="No id"/>'));
    expect(() => archimate.toJson()).toThrowError(
      'The model cannot be written as JSON: A concept of type BusinessActor named "No id" has no id.'
    );
  });

  it('throws for an id used twice', () => {
    const archimate = Archimate.fromXml(
      business(
        '<element xsi:type="archimate:BusinessActor" name="A" id="id-x"/><element xsi:type="archimate:BusinessRole" name="B" id="id-x"/>'
      )
    );
    expect(() => archimate.toJson()).toThrowError('the id "id-x" is used more than once');
  });

  it('throws for a concept with fields of another kind than its folder holds', () => {
    const archimate = Archimate.fromXml(
      business(
        '<element xsi:type="archimate:BusinessActor" name="A" id="id-a"/><element xsi:type="archimate:FlowRelationship" id="id-r" source="id-a" target="id-a"/>'
      )
    );
    expect(() => archimate.toJson()).toThrowError('"id-r" has the field "source", which a concept in elements does not have.');
  });

  it('throws for a connection held by another object than its source', () => {
    const archimate = Archimate.fromXml(
      modelXml(`<folder name="Business" id="id-business" type="business"><element xsi:type="archimate:BusinessActor" name="A" id="id-a"/></folder>
  <folder name="Views" id="id-views" type="diagrams">
    <element xsi:type="archimate:ArchimateDiagramModel" name="V" id="id-v">
      <child xsi:type="archimate:DiagramObject" id="id-o1" archimateElement="id-a">
        <bounds x="0" y="0" width="10" height="10"/>
        <sourceConnection xsi:type="archimate:Connection" id="id-c" source="id-o2" target="id-o1"/>
      </child>
      <child xsi:type="archimate:DiagramObject" id="id-o2" archimateElement="id-a"><bounds x="0" y="0" width="10" height="10"/></child>
    </element>
  </folder>`)
    );
    expect(() => archimate.toJson()).toThrowError('the connection "id-c" is held by "id-o1" in the file but has source "id-o2".');
  });
});

describe('fromJson on text that is not a model in the format', () => {
  const valid = () => JSON.parse(load(`${roundtripDir}/connection-to-connection.archimate`).toJson()) as ModelJson;
  const fromJson = (json: unknown) => () => Archimate.fromJson(JSON.stringify(json));

  it('throws not-json for text that is not JSON', () => {
    expect(() => Archimate.fromJson('{"formatVersion": 1,')).toThrowError(
      expect.objectContaining({ name: 'ArchimateParseError', kind: 'not-json' })
    );
  });

  it.each<[string, (json: ModelJson) => void, RegExp]>([
    ['another format version', json => Object.assign(json, { formatVersion: 2 }), /formatVersion: expected 1/],
    ['an unknown field', json => Object.assign(json.elements[0], { colour: 'red' }), /json\.elements\[0\]: unknown field "colour"/],
    [
      'a member no concept has',
      json => json.folders[1].members!.push('id-missing'),
      /no element, relationship or view has the id "id-missing"/,
    ],
    ['a concept in no folder', json => json.folders[1].members!.pop(), /is not a member of any folder/],
    ['a concept in two folders', json => json.folders[1].members!.push(json.folders[1].members![0]), /is a member of more than one folder/],
    [
      'a member of another kind',
      json => json.folders[1].members!.push(json.relationships[0].id),
      /is in relationships, but this folder holds elements/,
    ],
    [
      'a connection whose source is not in the view',
      json => (json.views[0].connections![0].source = 'id-missing'),
      /no diagram child or earlier connection/,
    ],
    ['extensions that are not XML', json => (json.elements[0].extensions = '<extensions'), /extensions: not well-formed XML/],
    ['folders out of order', json => json.folders.reverse(), /expected "strategy", as the folders are in Archi's order/],
  ])('throws invalid-structure for %s', (_, change, message) => {
    const json = valid();
    change(json);
    expect(fromJson(json)).toThrowError(expect.objectContaining({ name: 'ArchimateParseError', kind: 'invalid-structure' }));
    expect(fromJson(json)).toThrowError(message);
  });

  it('throws invalid-structure when the values are not those of a model', () => {
    const json = valid();
    (json.model as unknown as Record<string, unknown>).version = 5;
    expect(fromJson(json)).toThrowError(expect.objectContaining({ kind: 'invalid-structure' }));
  });
});

describe('the published schema', () => {
  it('is the committed schema/model-v1.json', () => {
    expect(readFileSync('schema/model-v1.json', 'utf8')).toBe(`${JSON.stringify(modelJsonSchema, null, 2)}\n`);
  });

  it('accepts the code names of a diagram child type only on that type', () => {
    const json = JSON.parse(load(`${roundtripDir}/diagram-features.archimate`).toJson()) as ModelJson;
    const group = { id: 'id-g', type: 'Group', bounds: { x: 0, y: 0, width: 1, height: 1 }, borderType: 'rectangle' };
    json.views[0].children!.push(group as never);
    expect(validate(json)).toBe(true);
    Object.assign(group, { borderType: 'dogEar' });
    expect(validate(json)).toBe(false);
    Object.assign(group, { type: 'Note' });
    expect(validate(json)).toBe(true);
    Object.assign(group, { type: 'SketchModelSticky' });
    expect(validate(json)).toBe(false);
  });

  it('rejects a document with a field it does not define', () => {
    const json = JSON.parse(load(`${roundtripDir}/minimal.archimate`).toJson());
    json.model.colour = 'red';
    expect(validate(json)).toBe(false);
  });
});
