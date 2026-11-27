import type {
  ChildSnapshot,
  ConnectionSnapshot,
  ElementSnapshot,
  FolderSnapshot,
  ModelSnapshot,
  ProfileSnapshot,
  SnapshotEntries,
  SnapshotOpaque,
} from '../interfaces/ModelSnapshot.mjs';
import type { JsonEntry, ModelJson, ProfileJson } from '../interfaces/ModelJson.mjs';
import type { FolderKey } from '../interfaces/Model.mjs';
import { folderType } from '../constants/archimate-mappings.mjs';
import {
  AccessType,
  ConnectionRouterType,
  ConnectionTextPosition,
  DiagramObjectFigure,
  GroupBorderType,
  NoteBorderType,
  TextAlignment,
  TextPosition,
} from '../constants/archi-codes.mjs';
import { buildXmlFragment, parseXmlFragment } from './Xml.mjs';

// The JSON format is a mapping of the snapshot, which already holds the model losslessly and canonically: equal
// .archimate text gives an equal snapshot. Writing turns the folder tree of concepts into flat lists sorted by id,
// with each folder listing its members, and moves every connection of a view into one list. Reading puts them back.

export const jsonFormatVersion = 1 as const;

const folderKeys = Array.from(folderType.keys());
type Record_ = Record<string, unknown>;

// Codes by name

type Codes = Readonly<Record<string, number>>;

/** `Codes` with names in JSON's casing: `ReadWrite` becomes `readWrite`. */
function namedCodes(codes: Codes): { toName: Map<number, string>; toCode: Map<string, number> } {
  const entries = Object.entries(codes).map(([name, code]) => [name[0].toLowerCase() + name.slice(1), code] as const);
  return { toName: new Map(entries.map(([name, code]) => [code, name])), toCode: new Map(entries) };
}

const codeTables = {
  accessType: namedCodes(AccessType),
  connectionRouterType: namedCodes(ConnectionRouterType),
  textAlignment: namedCodes(TextAlignment),
  textPosition: namedCodes(TextPosition),
  connectionTextPosition: namedCodes(ConnectionTextPosition),
  figure: namedCodes(DiagramObjectFigure),
  groupBorderType: namedCodes(GroupBorderType),
  noteBorderType: namedCodes(NoteBorderType),
};
type CodeTable = (typeof codeTables)[keyof typeof codeTables];

/** The tables for the coded fields of a diagram child, by its type. */
function childCodes(type: string): Record<string, CodeTable> {
  const tables: Record<string, CodeTable> = { textAlignment: codeTables.textAlignment, textPosition: codeTables.textPosition };
  if (type === 'DiagramObject') tables.figure = codeTables.figure;
  if (type === 'Group') tables.borderType = codeTables.groupBorderType;
  if (type === 'Note') tables.borderType = codeTables.noteBorderType;
  return tables;
}
const elementCodes = { accessType: codeTables.accessType, connectionRouterType: codeTables.connectionRouterType };
const connectionCodes = { textAlignment: codeTables.textAlignment, textPosition: codeTables.connectionTextPosition };

function codeToName(value: unknown, table: CodeTable | undefined): unknown {
  return table && typeof value === 'number' ? (table.toName.get(value) ?? value) : value;
}

function nameToCode(value: unknown, table: CodeTable | undefined, path: string): unknown {
  if (!table || typeof value !== 'string' || ['NaN', 'Infinity', '-Infinity'].includes(value)) return value;
  const code = table.toCode.get(value);
  if (code === undefined) fail(path, `unknown name ${JSON.stringify(value)}; expected one of ${[...table.toCode.keys()].join(', ')}`);
  return code;
}

// Errors

class JsonStructureError extends Error {}

function fail(path: string, message: string): never {
  throw new JsonStructureError(`${path}: ${message}`);
}

function cannotWrite(message: string): never {
  throw new Error(`The model cannot be written as JSON: ${message}`);
}

/** Whether an error came from reading a JSON document that is not in the format. */
export function isJsonStructureError(error: unknown): error is Error {
  return error instanceof JsonStructureError;
}

// Writing

/**
 * Copies the fields in `keys` that are set, in that order, naming the coded ones.
 */
function pick(source: Record_, keys: readonly string[], codes: Record<string, CodeTable> = {}): Record_ {
  const result: Record_ = {};
  for (const key of keys) {
    if (source[key] !== undefined) result[key] = codeToName(source[key], codes[key]);
  }
  return result;
}

function writeEntries(entries: SnapshotEntries | undefined): JsonEntry[] | undefined {
  return entries?.map(([key, value]) => ({ ...(key !== null && { key }), ...(value !== null && { value }) }));
}

function setEntries(target: Record_, key: string, entries: SnapshotEntries | undefined): void {
  const written = writeEntries(entries);
  if (written) target[key] = written;
}

function setExtensions(target: Record_, unrecognized: SnapshotOpaque | undefined): void {
  if (unrecognized) target.extensions = buildXmlFragment(unrecognized);
}

const elementKeys = ['type', 'name', 'documentation', 'profiles', 'junctionType'] as const;
const relationshipKeys = ['type', 'name', 'documentation', 'profiles', 'source', 'target', 'accessType', 'directed', 'strength'] as const;
const viewKeys = ['type', 'name', 'documentation', 'viewpoint', 'background', 'connectionRouterType'] as const;
const childKeys = [
  'type',
  'name',
  'archimateElement',
  'model',
  'bounds',
  'figure',
  'textAlignment',
  'textPosition',
  'fillColor',
  'alpha',
  'lineColor',
  'lineWidth',
  'font',
  'fontColor',
  'borderType',
  'borderColor',
  'imagePath',
  'imagePosition',
  'locked',
  'hintTitle',
  'targetConnections',
  'documentation',
  'content',
  'notes',
  'hintContent',
] as const;
const connectionKeys = [
  'type',
  'implicitType',
  'source',
  'target',
  'archimateRelationship',
  'name',
  'lineStyle',
  'font',
  'fontColor',
  'lineColor',
  'lineWidth',
  'textAlignment',
  'textPosition',
  'locked',
  'targetConnections',
  'documentation',
  'bendpoints',
] as const;
const conceptFieldsByList = {
  elements: new Set<string>(['id', ...elementKeys, 'properties', 'features', 'unrecognized']),
  relationships: new Set<string>(['id', ...relationshipKeys, 'properties', 'features', 'unrecognized']),
  views: new Set<string>(['id', ...viewKeys, 'properties', 'features', 'children', 'unrecognized']),
};
type ConceptList = keyof typeof conceptFieldsByList;

const listOf = (folderKey: FolderKey): ConceptList =>
  folderKey === 'relations' ? 'relationships' : folderKey === 'diagrams' ? 'views' : 'elements';

/**
 * Checks that every record that others refer to by id has one, and that no id is used twice.
 */
class IdRegistry {
  private readonly ids = new Set<string>();

  add(id: string | undefined, what: string): string {
    if (!id) cannotWrite(`${what} has no id.`);
    if (this.ids.has(id)) cannotWrite(`the id "${id}" is used more than once.`);
    this.ids.add(id);
    return id;
  }
}

/**
 * The model in the JSON format. Throws when a record lacks an id, an id is used twice, a concept has fields that
 * do not belong in its folder, or a connection is held by another object than its source: the format could not
 * give the same model back.
 */
export function snapshotToJson(snapshot: ModelSnapshot): ModelJson {
  const ids = new IdRegistry();
  const lists: { [K in ConceptList]: Record_[] } = { elements: [], relationships: [], views: [] };

  const model: Record_ = { id: snapshot.model.id };
  if (snapshot.model.name) model.name = snapshot.model.name;
  model.version = snapshot.model.version;
  if (snapshot.purpose !== undefined) model.purpose = snapshot.purpose;
  setEntries(model, 'properties', snapshot.properties);
  setEntries(model, 'metadata', snapshot.metadata);
  setExtensions(model, snapshot.unrecognized);

  const json: Record_ = { formatVersion: jsonFormatVersion, model };
  if (snapshot.profiles) json.profiles = snapshot.profiles.map(profile => writeProfile(profile, ids));

  const writeFolder = (folder: FolderSnapshot, list: ConceptList, what: string): Record_ => {
    const record: Record_ = { id: ids.add(folder.id, what) };
    if (folder.name) record.name = folder.name;
    if (folder.documentation !== undefined) record.documentation = folder.documentation;
    setEntries(record, 'properties', folder.properties);
    setEntries(record, 'features', folder.features);
    if (folder.elements) {
      record.members = folder.elements.map(element => {
        const concept = writeConcept(element, list, ids);
        lists[list].push(concept);
        return concept.id;
      });
    }
    if (folder.folders) record.folders = folder.folders.map(nested => writeFolder(nested, list, `A folder in "${folder.name}"`));
    setExtensions(record, folder.unrecognized);
    return record;
  };
  json.folders = folderKeys.map(key => {
    const { id, ...rest } = writeFolder(snapshot.folders[key], listOf(key), `The ${key} folder`);
    return { id, type: key, ...rest };
  });

  const byId = (a: Record_, b: Record_) => ((a.id as string) < (b.id as string) ? -1 : 1);
  json.elements = lists.elements.sort(byId);
  json.relationships = lists.relationships.sort(byId);
  json.views = lists.views.sort(byId);

  const extensions: Record_ = {};
  if (snapshot.xml.length > 0) extensions.xmlDeclaration = snapshot.xml.map(([name, value]) => ({ name, value }));
  if (snapshot.model.namespaces.length > 0) extensions.namespaces = snapshot.model.namespaces.map(([prefix, uri]) => ({ prefix, uri }));
  if (Object.keys(extensions).length > 0) json.extensions = extensions;
  return json as unknown as ModelJson;
}

function writeProfile(profile: ProfileSnapshot, ids: IdRegistry): ProfileJson {
  const record: Record_ = { id: ids.add(profile.id, `The profile "${profile.name}"`) };
  if (profile.name) record.name = profile.name;
  Object.assign(record, pick(profile as unknown as Record_, ['conceptType', 'imagePath', 'specialization']));
  setEntries(record, 'features', profile.features);
  return record as unknown as ProfileJson;
}

function writeConcept(element: ElementSnapshot, list: ConceptList, ids: IdRegistry): Record_ & { id: string } {
  const id = ids.add(element.id, `A concept of type ${element.type} named "${element.name}"`);
  const misplaced = Object.keys(element).find(key => !conceptFieldsByList[list].has(key));
  if (misplaced) cannotWrite(`"${id}" has the field "${misplaced}", which a concept in ${list} does not have.`);

  const keys = list === 'elements' ? elementKeys : list === 'relationships' ? relationshipKeys : viewKeys;
  const record: Record_ = { id, ...pick(element as unknown as Record_, keys, elementCodes) };
  if (record.name === '') delete record.name;
  setEntries(record, 'properties', element.properties);
  setEntries(record, 'features', element.features);
  if (list === 'views' && element.children) {
    const connections: Record_[] = [];
    record.children = element.children.map(child => writeChild(child, connections, ids));
    if (connections.length > 0) record.connections = connections;
  }
  setExtensions(record, element.unrecognized);
  return record as Record_ & { id: string };
}

function writeChild(child: ChildSnapshot, connections: Record_[], ids: IdRegistry): Record_ {
  const id = ids.add(child.id, `A diagram child of type ${child.type}`);
  const record: Record_ = { id, ...pick(child as unknown as Record_, childKeys, childCodes(child.type)) };
  setEntries(record, 'properties', child.properties);
  setEntries(record, 'features', child.features);
  for (const connection of child.connections ?? []) writeConnection(connection, id, connections, ids);
  if (child.children) record.children = child.children.map(nested => writeChild(nested, connections, ids));
  setExtensions(record, child.unrecognized);
  return record;
}

function writeConnection(connection: ConnectionSnapshot, ownerId: string, connections: Record_[], ids: IdRegistry): void {
  const id = ids.add(connection.id, `A view connection starting on "${connection.source}"`);
  if (connection.source !== ownerId) {
    cannotWrite(`the connection "${id}" is held by "${ownerId}" in the file but has source "${connection.source}".`);
  }
  const record: Record_ = { id, ...pick(connection as unknown as Record_, connectionKeys, connectionCodes) };
  setEntries(record, 'properties', connection.properties);
  setEntries(record, 'features', connection.features);
  setExtensions(record, connection.unrecognized);
  connections.push(record);
  for (const nested of connection.connections ?? []) writeConnection(nested, id, connections, ids);
}

// Reading

function readObject(value: unknown, path: string, allowed: ReadonlySet<string>): Record_ {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected an object');
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail(path, `unknown field "${key}"`);
  return value as Record_;
}

function readArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'expected an array');
  return value;
}

function readId(value: unknown, path: string): string {
  if (typeof value !== 'string' || value === '') fail(path, 'expected a non-empty id');
  return value;
}

function readEntries(value: unknown, path: string): SnapshotEntries | undefined {
  if (value === undefined) return undefined;
  return readArray(value, path).map((entry, i) => {
    const record = readObject(entry, `${path}[${i}]`, entryKeys);
    return [record.key === undefined ? null : record.key, record.value === undefined ? null : record.value] as [string, string];
  });
}

function readExtensions(value: unknown, path: string): SnapshotOpaque | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') fail(path, 'expected a string of XML');
  try {
    return parseXmlFragment(value) as SnapshotOpaque;
  } catch (error) {
    fail(path, (error as Error).message);
  }
}

/** Copies the fields in `keys` that are set, turning named codes back into numbers. The snapshot reader checks types. */
function unpick(target: Record_, source: Record_, keys: readonly string[], codes: Record<string, CodeTable>, path: string): void {
  for (const key of keys) {
    if (source[key] !== undefined) target[key] = nameToCode(source[key], codes[key], `${path}.${key}`);
  }
}

const entryKeys = new Set(['key', 'value']);
const documentKeys = new Set(['formatVersion', 'model', 'profiles', 'folders', 'elements', 'relationships', 'views', 'extensions']);
const modelKeys = new Set(['id', 'name', 'version', 'purpose', 'properties', 'metadata', 'extensions']);
const profileKeys = new Set(['id', 'name', 'conceptType', 'imagePath', 'specialization', 'features']);
const folderKeySet = new Set(['id', 'name', 'documentation', 'properties', 'features', 'members', 'folders', 'extensions']);
const topLevelFolderKeySet = new Set([...folderKeySet, 'type']);
const recordKeys = {
  elements: new Set(['id', ...elementKeys, 'properties', 'features', 'extensions']),
  relationships: new Set(['id', ...relationshipKeys, 'properties', 'features', 'extensions']),
  views: new Set(['id', ...viewKeys, 'properties', 'features', 'children', 'connections', 'extensions']),
};
const childKeySet = new Set(['id', ...childKeys, 'properties', 'features', 'children', 'extensions']);
const connectionKeySet = new Set(['id', ...connectionKeys, 'properties', 'features', 'extensions']);
const extensionKeys = new Set(['xmlDeclaration', 'namespaces']);

/**
 * The snapshot for a document in the JSON format. Throws a `JsonStructureError` when it is not in the format; the
 * snapshot reader then checks the values.
 */
export function jsonToSnapshot(value: unknown): ModelSnapshot {
  const json = readObject(value, 'json', documentKeys);
  if (json.formatVersion !== jsonFormatVersion) {
    fail(
      'json.formatVersion',
      `expected ${jsonFormatVersion}, the only version this tsarchi reads, got ${JSON.stringify(json.formatVersion)}`
    );
  }

  const model = readObject(json.model, 'json.model', modelKeys);
  const extensions = json.extensions === undefined ? {} : readObject(json.extensions, 'json.extensions', extensionKeys);
  const snapshot: Record_ = {
    version: 1,
    xml:
      extensions.xmlDeclaration === undefined
        ? []
        : readArray(extensions.xmlDeclaration, 'json.extensions.xmlDeclaration').map((item, i) => {
            const attribute = readObject(item, `json.extensions.xmlDeclaration[${i}]`, new Set(['name', 'value']));
            return [attribute.name, attribute.value];
          }),
    model: {
      id: model.id,
      name: model.name ?? '',
      version: model.version,
      namespaces:
        extensions.namespaces === undefined
          ? []
          : readArray(extensions.namespaces, 'json.extensions.namespaces').map((item, i) => {
              const namespace = readObject(item, `json.extensions.namespaces[${i}]`, new Set(['prefix', 'uri']));
              return [namespace.prefix, namespace.uri];
            }),
    },
  };
  if (model.purpose !== undefined) snapshot.purpose = model.purpose;
  const properties = readEntries(model.properties, 'json.model.properties');
  if (properties) snapshot.properties = properties;
  const metadata = readEntries(model.metadata, 'json.model.metadata');
  if (metadata) snapshot.metadata = metadata;
  if (json.profiles !== undefined) {
    snapshot.profiles = readArray(json.profiles, 'json.profiles').map((item, i) => {
      const profile = readObject(item, `json.profiles[${i}]`, profileKeys);
      const read: Record_ = { id: readId(profile.id, `json.profiles[${i}].id`), name: profile.name ?? '' };
      unpick(read, profile, ['conceptType', 'imagePath', 'specialization'], {}, `json.profiles[${i}]`);
      const features = readEntries(profile.features, `json.profiles[${i}].features`);
      if (features) read.features = features;
      return read;
    });
  }
  const unrecognized = readExtensions(model.extensions, 'json.model.extensions');
  if (unrecognized) snapshot.unrecognized = unrecognized;

  // Concepts by id, each to be placed once by a folder's members.
  const concepts = new Map<string, { record: Record_; list: ConceptList; path: string }>();
  for (const list of ['elements', 'relationships', 'views'] as const) {
    readArray(json[list] ?? [], `json.${list}`).forEach((item, i) => {
      const path = `json.${list}[${i}]`;
      const record = readObject(item, path, recordKeys[list]);
      const id = readId(record.id, `${path}.id`);
      if (concepts.has(id)) fail(`${path}.id`, `the id "${id}" is used more than once`);
      concepts.set(id, { record, list, path });
    });
  }
  const placed = new Set<string>();

  const readFolder = (item: unknown, path: string, list: ConceptList, allowed: ReadonlySet<string>): Record_ => {
    const folder = readObject(item, path, allowed);
    const read: Record_ = { id: readId(folder.id, `${path}.id`), name: folder.name ?? '' };
    if (folder.documentation !== undefined) read.documentation = folder.documentation;
    const folderProperties = readEntries(folder.properties, `${path}.properties`);
    if (folderProperties) read.properties = folderProperties;
    const features = readEntries(folder.features, `${path}.features`);
    if (features) read.features = features;
    if (folder.folders !== undefined) {
      read.folders = readArray(folder.folders, `${path}.folders`).map((nested, i) =>
        readFolder(nested, `${path}.folders[${i}]`, list, folderKeySet)
      );
    }
    if (folder.members !== undefined) {
      read.elements = readArray(folder.members, `${path}.members`).map((member, i) => {
        const at = `${path}.members[${i}]`;
        const id = readId(member, at);
        const concept = concepts.get(id);
        if (!concept) fail(at, `no element, relationship or view has the id "${id}"`);
        if (concept.list !== list) fail(at, `"${id}" is in ${concept.list}, but this folder holds ${list}`);
        if (placed.has(id)) fail(at, `"${id}" is a member of more than one folder`);
        placed.add(id);
        return readConcept(concept.record, concept.list, concept.path);
      });
    }
    const folderUnrecognized = readExtensions(folder.extensions, `${path}.extensions`);
    if (folderUnrecognized) read.unrecognized = folderUnrecognized;
    return read;
  };

  const folders = readArray(json.folders, 'json.folders');
  if (folders.length !== folderKeys.length) fail('json.folders', `expected the ${folderKeys.length} top-level folders`);
  const topLevel: Record_ = {};
  folders.forEach((item, i) => {
    const key = folderKeys[i];
    const path = `json.folders[${i}]`;
    if ((item as Record_ | null)?.type !== key) fail(`${path}.type`, `expected "${key}", as the folders are in Archi's order`);
    topLevel[key] = readFolder(item, path, listOf(key), topLevelFolderKeySet);
  });
  snapshot.folders = topLevel;

  for (const [id, concept] of concepts) {
    if (!placed.has(id)) fail(concept.path, `"${id}" is not a member of any folder`);
  }
  return snapshot as unknown as ModelSnapshot;
}

function readConcept(record: Record_, list: ConceptList, path: string): Record_ {
  const keys = list === 'elements' ? elementKeys : list === 'relationships' ? relationshipKeys : viewKeys;
  const read: Record_ = { id: record.id };
  unpick(read, record, keys, elementCodes, path);
  read.name = record.name ?? '';
  const properties = readEntries(record.properties, `${path}.properties`);
  if (properties) read.properties = properties;
  const features = readEntries(record.features, `${path}.features`);
  if (features) read.features = features;
  if (list === 'views' && record.children !== undefined) {
    const owners = new Map<string, Record_>();
    read.children = readArray(record.children, `${path}.children`).map((child, i) => readChild(child, `${path}.children[${i}]`, owners));
    if (record.connections !== undefined) {
      readArray(record.connections, `${path}.connections`).forEach((item, i) => {
        const at = `${path}.connections[${i}]`;
        const connection = readConnection(item, at);
        const owner = owners.get(connection.source as string);
        if (!owner)
          fail(`${at}.source`, `no diagram child or earlier connection in the view has the id ${JSON.stringify(connection.source)}`);
        if (owners.has(connection.id as string)) fail(`${at}.id`, `the id "${connection.id}" is used more than once in the view`);
        ((owner.connections ??= []) as Record_[]).push(connection);
        owners.set(connection.id as string, connection);
      });
    }
  } else if (record.connections !== undefined) {
    fail(`${path}.connections`, 'a view without children has no connections');
  }
  const unrecognized = readExtensions(record.extensions, `${path}.extensions`);
  if (unrecognized) read.unrecognized = unrecognized;
  return read;
}

function readChild(item: unknown, path: string, owners: Map<string, Record_>): Record_ {
  const child = readObject(item, path, childKeySet);
  const id = readId(child.id, `${path}.id`);
  if (typeof child.type !== 'string') fail(`${path}.type`, 'expected a string');
  if (owners.has(id)) fail(`${path}.id`, `the id "${id}" is used more than once in the view`);
  const read: Record_ = { id };
  unpick(read, child, childKeys, childCodes(child.type), path);
  const properties = readEntries(child.properties, `${path}.properties`);
  if (properties) read.properties = properties;
  const features = readEntries(child.features, `${path}.features`);
  if (features) read.features = features;
  owners.set(id, read);
  if (child.children !== undefined) {
    read.children = readArray(child.children, `${path}.children`).map((nested, i) => readChild(nested, `${path}.children[${i}]`, owners));
  }
  const unrecognized = readExtensions(child.extensions, `${path}.extensions`);
  if (unrecognized) read.unrecognized = unrecognized;
  return read;
}

function readConnection(item: unknown, path: string): Record_ {
  const connection = readObject(item, path, connectionKeySet);
  const read: Record_ = { id: readId(connection.id, `${path}.id`) };
  unpick(read, connection, connectionKeys, connectionCodes, path);
  readId(connection.source, `${path}.source`);
  const properties = readEntries(connection.properties, `${path}.properties`);
  if (properties) read.properties = properties;
  const features = readEntries(connection.features, `${path}.features`);
  if (features) read.features = features;
  const unrecognized = readExtensions(connection.extensions, `${path}.extensions`);
  if (unrecognized) read.unrecognized = unrecognized;
  return read;
}

/** The JSON text of a document: two-space indentation, one value per line, and a final line break. */
export function formatJson(json: ModelJson): string {
  return `${JSON.stringify(json, null, 2)}\n`;
}
