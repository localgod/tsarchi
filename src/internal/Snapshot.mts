import type { Child } from '../interfaces/Child.mjs';
import type { Element } from '../interfaces/Element.mjs';
import type { Folder } from '../interfaces/Folder.mjs';
import type { FolderKey, Model, ModelContent, ModelFolder } from '../interfaces/Model.mjs';
import type { Profile } from '../interfaces/Profile.mjs';
import type { SourceConnection } from '../interfaces/SourceConnection.mjs';
import type { ViewBendpoint } from '../interfaces/View.mjs';
import type {
  ChildSnapshot,
  ConnectionSnapshot,
  ElementSnapshot,
  FolderSnapshot,
  ModelSnapshot,
  ProfileSnapshot,
  SnapshotEntries,
  SnapshotNumber,
  SnapshotOpaque,
} from '../interfaces/ModelSnapshot.mjs';
import type { ModelAttributes } from '../interfaces/schema/Model.mjs';
import type { XmlMetadata } from '../interfaces/schema/XmlMetadata.mjs';
import type { ArchimateModelType } from '../constants/archimate-mappings.mjs';
import { ArchimateParseError } from '../interfaces/ArchimateParseError.mjs';
import { folderType, toXsiType, typeFromXsiType } from '../constants/archimate-mappings.mjs';
import {
  DiagramAttributeMapper,
  childAttributes,
  childFeatures,
  childTextElements,
  conceptAttributes,
  connectionAttributes,
  connectionFeatures,
  viewAttributes,
} from './DiagramAttributeMapper.mjs';
import type { AttributeSpec } from './DiagramAttributeMapper.mjs';
import { toArray } from './Arrays.mjs';

// A snapshot holds the model as fromXml(toXml()) would load it: the writer applies the normalisation the Serializer
// does (values written as strings, empty collections and falsy text left out, elements placed in their folders), and
// the reader builds the domain objects the Parser would. Equal XML therefore gives equal snapshots.

export const snapshotVersion = 1 as const;

/**
 * The state of an Archimate instance that a snapshot holds.
 */
export interface SnapshotState {
  model: Model;
  content: ModelContent;
  xmlMetadata: XmlMetadata;
  /** The model's root attributes, as `Archimate` builds them from what the file declares. */
  root: { namespaces: Record<`@_xmlns:${string}`, string>; name: string; id?: string; version?: string };
}

const folderKeys = Array.from(folderType.keys()) as FolderKey[];
const boundsKeys = ['x', 'y', 'width', 'height'] as const;
const boundsDefaults = { x: 0, y: 0, width: -1, height: -1 };
const bendpointKeys = ['startX', 'startY', 'endX', 'endY'] as const;

// Writing

/**
 * Returns the model as a snapshot. `rootAttributes` are the root attributes as `toXml()` writes them, with the
 * namespaces it adds.
 */
export function writeSnapshot(
  model: Model,
  content: ModelContent,
  xmlMetadata: XmlMetadata,
  rootAttributes: ModelAttributes,
  defaults: ModelAttributes
): ModelSnapshot {
  const snapshot: ModelSnapshot = {
    version: snapshotVersion,
    xml: Object.entries(xmlMetadata)
      .filter(([key]) => key.startsWith('@_'))
      .map(([key, value]) => [key.slice(2), String(value)]),
    model: {
      id: String(rootAttributes['@_id'] || defaults['@_id']),
      name: String(rootAttributes['@_name'] || ''),
      version: String(rootAttributes['@_version'] || defaults['@_version']),
      namespaces: Object.entries(rootAttributes)
        .filter(([key, value]) => key.startsWith('@_xmlns:') && value)
        .map(([key, value]) => [key.slice('@_xmlns:'.length), String(value)]),
    },
    folders: {} as ModelSnapshot['folders'],
  };
  if (content.purpose) snapshot.purpose = String(content.purpose);
  setEntries(snapshot, 'properties', content.properties);
  if (content.metadata) snapshot.metadata = writeEntries(content.metadata);
  if (content.profiles && content.profiles.length > 0) snapshot.profiles = content.profiles.map(writeProfile);
  for (const key of folderKeys) {
    snapshot.folders[key] = writeTopLevelFolder(key, model[key]);
  }
  setOpaque(snapshot, content.unrecognized);
  return snapshot;
}

function writeEntries(map: Map<unknown, unknown>): SnapshotEntries {
  return Array.from(map, ([key, value]) => [key == null ? null : String(key), value == null ? null : String(value)]);
}

function setEntries(target: object, key: string, map: Map<unknown, unknown> | undefined): void {
  if (map && map.size > 0) (target as Record<string, unknown>)[key] = writeEntries(map);
}

function setOpaque(target: { unrecognized?: SnapshotOpaque }, unrecognized: Record<string, unknown> | undefined): void {
  if (unrecognized && Object.keys(unrecognized).length > 0) {
    target.unrecognized = copyOpaque(unrecognized, 'unrecognized', message => {
      throw new TypeError(`The model cannot be written to a snapshot: ${message}`);
    }) as SnapshotOpaque;
  }
}

function writeNumber(value: number): SnapshotNumber {
  if (value === 0) return 0;
  return Number.isFinite(value) ? value : String(value);
}

/**
 * Writes the given attributes as the Serializer does and normalises them as the Parser reads them back.
 */
function writeAttributes(target: object, source: object, specs: readonly AttributeSpec[]): void {
  const from = source as Record<string, unknown>;
  const to = target as Record<string, unknown>;
  for (const [property, , kind] of specs) {
    const value = from[property];
    if (value === undefined || value === null) continue;
    to[property] =
      kind === 'number'
        ? writeNumber(typeof value === 'number' ? value : Number(String(value)))
        : kind === 'boolean'
          ? String(value) === 'true'
          : String(value);
  }
}

function canonicalType(type: string): string {
  return typeFromXsiType(toXsiType(type));
}

function writeProfile(profile: Profile): ProfileSnapshot {
  const snapshot = {} as ProfileSnapshot;
  if (profile.id != null) snapshot.id = String(profile.id);
  snapshot.name = String(profile.name ?? '');
  if (profile.conceptType !== undefined) snapshot.conceptType = String(profile.conceptType);
  if (profile.imagePath !== undefined) snapshot.imagePath = String(profile.imagePath);
  if (profile.specialization !== undefined) snapshot.specialization = String(profile.specialization) === 'true';
  setEntries(snapshot, 'features', profile.features);
  return snapshot;
}

function writeFolderDetails(folder: ModelFolder | Folder, name: string): FolderSnapshot {
  const snapshot: FolderSnapshot = { id: String(folder.id || ''), name };
  if (folder.documentation) snapshot.documentation = String(folder.documentation);
  setEntries(snapshot, 'properties', folder.properties);
  setEntries(snapshot, 'features', folder.features);
  return snapshot;
}

/**
 * Places elements in their folders as the Serializer does: nested folders first, depth-first, each claiming the
 * listed elements not yet placed; the top-level folder keeps the rest, in list order.
 */
function writeTopLevelFolder(key: FolderKey, folder: ModelFolder): FolderSnapshot {
  const snapshot = writeFolderDetails(folder, String(folder.name || folderType.get(key)));
  const elements = Array.isArray(folder.elements) ? folder.elements : [];
  const elementsById = new Map(elements.map(element => [element.id, element]));
  const placedIds = new Set<string>();
  if (folder.folders && folder.folders.length > 0) {
    snapshot.folders = folder.folders.map(subfolder => writeFolder(subfolder, elementsById, placedIds));
  }
  const topLevel = elements.filter(element => !placedIds.has(element.id));
  if (topLevel.length > 0) snapshot.elements = topLevel.map(writeElement);
  setOpaque(snapshot, folder.unrecognized);
  return snapshot;
}

function writeFolder(folder: Folder, elementsById: Map<string, Element>, placedIds: Set<string>): FolderSnapshot {
  const snapshot = writeFolderDetails(folder, String(folder.name || ''));
  if (folder.folders && folder.folders.length > 0) {
    snapshot.folders = folder.folders.map(subfolder => writeFolder(subfolder, elementsById, placedIds));
  }
  const elements: ElementSnapshot[] = [];
  for (const id of folder.elementIds || []) {
    const element = elementsById.get(id);
    if (!element || placedIds.has(id)) continue;
    placedIds.add(id);
    elements.push(writeElement(element));
  }
  if (elements.length > 0) snapshot.elements = elements;
  setOpaque(snapshot, folder.unrecognized);
  return snapshot;
}

function writeElement(element: Element): ElementSnapshot {
  const snapshot = {} as ElementSnapshot;
  if (element.id != null) snapshot.id = String(element.id);
  snapshot.type = element.type ? canonicalType(element.type) : '';
  snapshot.name = element.name ? String(element.name) : '';
  if (element.profiles) snapshot.profiles = String(element.profiles);
  writeAttributes(snapshot, element, viewAttributes);
  if (element.source && element.target) {
    snapshot.source = String(element.source);
    snapshot.target = String(element.target);
  }
  writeAttributes(snapshot, element, conceptAttributes);
  if (element.documentation) snapshot.documentation = String(element.documentation);
  setEntries(snapshot, 'properties', element.properties);
  setEntries(snapshot, 'features', element.features);
  const children = toArray(element.child);
  if (children.length > 0) snapshot.children = children.map(writeChild);
  setOpaque(snapshot, element.unrecognized);
  return snapshot;
}

function writeChild(child: Child): ChildSnapshot {
  const snapshot = {} as ChildSnapshot;
  if (child.id != null) snapshot.id = String(child.id);
  snapshot.type = canonicalType(String(child.type));
  writeAttributes(snapshot, child, childAttributes);
  const bounds = {} as ChildSnapshot['bounds'];
  for (const key of boundsKeys) {
    const value = child.bounds[key];
    bounds[key] = value === boundsDefaults[key] ? value : writeNumber(Number(String(value)) || 0);
  }
  snapshot.bounds = bounds;
  for (const key of childTextElements) {
    if (child[key]) snapshot[key] = String(child[key]);
  }
  setEntries(snapshot, 'properties', child.properties);
  setEntries(snapshot, 'features', DiagramAttributeMapper.writeFeatures(child, child.features, childFeatures));
  if (child.child && child.child.length > 0) snapshot.children = child.child.map(writeChild);
  const connections = toArray(child.sourceConnection);
  if (connections.length > 0) snapshot.connections = connections.map(writeConnection);
  setOpaque(snapshot, child.unrecognized);
  return snapshot;
}

function writeConnection(connection: SourceConnection): ConnectionSnapshot {
  const snapshot = {} as ConnectionSnapshot;
  if (connection.id != null) snapshot.id = String(connection.id);
  snapshot.type = canonicalType(String(connection.type));
  if (connection.implicitType && connection.type === 'Connection') snapshot.implicitType = true;
  if (connection.source != null) snapshot.source = String(connection.source);
  if (connection.target != null) snapshot.target = String(connection.target);
  if (connection.archimateRelationship != null) snapshot.archimateRelationship = String(connection.archimateRelationship);
  writeAttributes(snapshot, connection, connectionAttributes);
  if (connection.documentation) snapshot.documentation = String(connection.documentation);
  if (connection.bendpoints && connection.bendpoints.length > 0) {
    snapshot.bendpoints = connection.bendpoints.map(bendpoint => {
      const written = {} as NonNullable<ConnectionSnapshot['bendpoints']>[number];
      for (const key of bendpointKeys) written[key] = writeNumber(Number(bendpoint[key]) || 0);
      return written;
    });
  }
  setEntries(snapshot, 'properties', connection.properties);
  setEntries(snapshot, 'features', DiagramAttributeMapper.writeFeatures(connection, connection.features, connectionFeatures));
  const connections = toArray(connection.sourceConnection);
  if (connections.length > 0) snapshot.connections = connections.map(writeConnection);
  setOpaque(snapshot, connection.unrecognized);
  return snapshot;
}

// Reading

class SnapshotError extends Error {}

function fail(path: string, message: string): never {
  throw new SnapshotError(`${path}: ${message}`);
}

/**
 * Copies JSON data: plain objects, arrays, strings, finite numbers, booleans and null. Keys are copied as own
 * properties, so a `__proto__` key never changes a prototype. Object keys holding undefined are left out, as JSON does.
 */
function copyOpaque(value: unknown, path: string, invalid: (message: string) => never): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : invalid(`${path} is not a finite number`);
  }
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    for (let i = 0; i < value.length; i++) copy.push(copyOpaque(value[i], `${path}[${i}]`, invalid));
    return copy;
  }
  if (isPlainObject(value)) {
    const entries: [string, unknown][] = [];
    for (const key of Object.keys(value)) {
      const item = value[key];
      if (item !== undefined) entries.push([key, copyOpaque(item, `${path}.${key}`, invalid)]);
    }
    return Object.fromEntries(entries);
  }
  return invalid(`${path} is not JSON data`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readObject(value: unknown, path: string, keys: ReadonlySet<string>): Record<string, unknown> {
  if (!isPlainObject(value)) fail(path, 'expected an object');
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) fail(path, `unexpected key '${key}'`);
  }
  return value;
}

function readArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'expected an array');
  return value;
}

function readString(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'expected a string');
  return value;
}

function readOptionalString(value: unknown, path: string): string | undefined {
  return value === undefined ? undefined : readString(value, path);
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'expected a boolean');
  return value;
}

function readNumber(value: unknown, path: string): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(path, 'expected a finite number');
    return value;
  }
  if (value === 'NaN' || value === 'Infinity' || value === '-Infinity') return Number(value);
  return fail(path, 'expected a number');
}

function readEntries(value: unknown, path: string): Map<string, string> {
  const map = new Map<string, string>();
  readArray(value, path).forEach((entry, i) => {
    const pair = readArray(entry, `${path}[${i}]`);
    if (pair.length !== 2) fail(`${path}[${i}]`, 'expected a [key, value] pair');
    const [key, item] = pair.map((part, j) => (part === null ? undefined : readString(part, `${path}[${i}][${j}]`)));
    map.set(key as string, item as string);
  });
  return map;
}

function readOptionalEntries(value: unknown, path: string): Map<string, string> | undefined {
  return value === undefined ? undefined : readEntries(value, path);
}

function readOpaque(value: unknown, path: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) fail(path, 'expected an object');
  return copyOpaque(value, path, message => fail(path, message)) as Record<string, unknown>;
}

function readAttributes(target: object, source: Record<string, unknown>, specs: readonly AttributeSpec[], path: string): void {
  const to = target as Record<string, unknown>;
  for (const [property, , kind] of specs) {
    const value = source[property];
    if (value === undefined) continue;
    const at = `${path}.${property}`;
    to[property] = kind === 'number' ? readNumber(value, at) : kind === 'boolean' ? readBoolean(value, at) : readString(value, at);
  }
}

const attributeNames = (specs: readonly AttributeSpec[]) => specs.map(([property]) => property);
const snapshotKeys = new Set(['version', 'xml', 'model', 'purpose', 'properties', 'metadata', 'profiles', 'folders', 'unrecognized']);
const rootKeys = new Set(['id', 'name', 'version', 'namespaces']);
const profileKeys = new Set(['id', 'name', 'conceptType', 'imagePath', 'specialization', 'features']);
const folderKeySet = new Set<string>(folderKeys);
const folderSnapshotKeys = new Set(['id', 'name', 'documentation', 'properties', 'features', 'folders', 'elements', 'unrecognized']);
const elementKeys = new Set([
  'id',
  'type',
  'name',
  'profiles',
  ...attributeNames(viewAttributes),
  'source',
  'target',
  ...attributeNames(conceptAttributes),
  'documentation',
  'properties',
  'features',
  'children',
  'unrecognized',
]);
const childKeys = new Set([
  'id',
  'type',
  ...attributeNames(childAttributes),
  'bounds',
  ...childTextElements,
  'properties',
  'features',
  'children',
  'connections',
  'unrecognized',
]);
const connectionKeys = new Set([
  'id',
  'type',
  'implicitType',
  'source',
  'target',
  'archimateRelationship',
  ...attributeNames(connectionAttributes),
  'documentation',
  'bendpoints',
  'properties',
  'features',
  'connections',
  'unrecognized',
]);
const boundsKeySet = new Set<string>(boundsKeys);
const bendpointKeySet = new Set<string>(bendpointKeys);

/**
 * Reads a snapshot into the domain objects the Parser would build from the same model's XML. Throws an
 * ArchimateParseError (`invalid-structure`) for anything that is not a snapshot of a known version.
 */
export function readSnapshot(value: unknown): SnapshotState {
  try {
    return readModel(value);
  } catch (error) {
    const reason = error instanceof SnapshotError ? error.message : `snapshot: ${error instanceof Error ? error.message : String(error)}`;
    throw new ArchimateParseError('invalid-structure', `Not a valid model snapshot at ${reason}`, { cause: error });
  }
}

function readModel(value: unknown): SnapshotState {
  const snapshot = readObject(value, 'snapshot', snapshotKeys);
  if (snapshot.version !== snapshotVersion) fail('snapshot.version', `unsupported version ${JSON.stringify(snapshot.version)}`);

  const xmlMetadata = Object.fromEntries(
    Array.from(readEntries(snapshot.xml, 'snapshot.xml'), ([key, item]) => [`@_${key}`, readString(item, `snapshot.xml.${key}`)])
  ) as unknown as XmlMetadata;

  const root = readObject(snapshot.model, 'snapshot.model', rootKeys);
  const namespaces: SnapshotState['root']['namespaces'] = {};
  for (const [prefix, uri] of readEntries(root.namespaces, 'snapshot.model.namespaces')) {
    const key = `@_xmlns:${readString(prefix, 'snapshot.model.namespaces')}` as const;
    if (uri) namespaces[key] = uri;
  }

  const content: ModelContent = {};
  const purpose = readOptionalString(snapshot.purpose, 'snapshot.purpose');
  if (purpose !== undefined) content.purpose = purpose;
  const properties = readOptionalEntries(snapshot.properties, 'snapshot.properties');
  if (properties && properties.size > 0) content.properties = properties;
  const metadata = readOptionalEntries(snapshot.metadata, 'snapshot.metadata');
  if (metadata) content.metadata = metadata;
  if (snapshot.profiles !== undefined) {
    content.profiles = readArray(snapshot.profiles, 'snapshot.profiles').map((profile, i) =>
      readProfile(profile, `snapshot.profiles[${i}]`)
    );
  }
  const unrecognized = readOpaque(snapshot.unrecognized, 'snapshot.unrecognized');
  if (unrecognized) content.unrecognized = unrecognized;

  const folders = readObject(snapshot.folders, 'snapshot.folders', folderKeySet);
  const model = {} as Model;
  for (const key of folderKeys) {
    if (folders[key] === undefined) fail('snapshot.folders', `missing folder '${key}'`);
    model[key] = readTopLevelFolder(folders[key], `snapshot.folders.${key}`);
  }

  return {
    model,
    content,
    xmlMetadata,
    root: {
      namespaces,
      name: readString(root.name, 'snapshot.model.name'),
      id: readString(root.id, 'snapshot.model.id'),
      version: readString(root.version, 'snapshot.model.version'),
    },
  };
}

function readProfile(value: unknown, path: string): Profile {
  const source = readObject(value, path, profileKeys);
  const profile = {} as Profile;
  const id = readOptionalString(source.id, `${path}.id`);
  if (id !== undefined) profile.id = id;
  profile.name = readString(source.name, `${path}.name`);
  const conceptType = readOptionalString(source.conceptType, `${path}.conceptType`);
  if (conceptType !== undefined) profile.conceptType = conceptType;
  const imagePath = readOptionalString(source.imagePath, `${path}.imagePath`);
  if (imagePath !== undefined) profile.imagePath = imagePath;
  if (source.specialization !== undefined) profile.specialization = readBoolean(source.specialization, `${path}.specialization`);
  const features = readOptionalEntries(source.features, `${path}.features`);
  if (features) profile.features = features;
  return profile;
}

function readFolderDetails(source: Record<string, unknown>, path: string): Omit<Folder, 'elementIds' | 'folders'> {
  const folder: Omit<Folder, 'elementIds' | 'folders'> = {
    id: readString(source.id, `${path}.id`),
    name: readString(source.name, `${path}.name`),
  };
  const documentation = readOptionalString(source.documentation, `${path}.documentation`);
  if (documentation !== undefined) folder.documentation = documentation;
  const properties = readOptionalEntries(source.properties, `${path}.properties`);
  if (properties && properties.size > 0) folder.properties = properties;
  const features = readOptionalEntries(source.features, `${path}.features`);
  if (features) folder.features = features;
  const unrecognized = readOpaque(source.unrecognized, `${path}.unrecognized`);
  if (unrecognized) folder.unrecognized = unrecognized;
  return folder;
}

function readElements(value: unknown, path: string): Element[] {
  return value === undefined ? [] : readArray(value, path).map((element, i) => readElement(element, `${path}[${i}]`));
}

/**
 * Reads nested folders depth-first, collecting their elements into the top-level folder's flat list, as the Parser does.
 */
function readFolders(value: unknown, path: string, elements: Element[]): Folder[] {
  if (value === undefined) return [];
  return readArray(value, path).map((item, i) => {
    const at = `${path}[${i}]`;
    const source = readObject(item, at, folderSnapshotKeys);
    const folders = readFolders(source.folders, `${at}.folders`, elements);
    const folderElements = readElements(source.elements, `${at}.elements`);
    elements.push(...folderElements);
    const folder: Folder = readFolderDetails(source, at);
    if (folderElements.length > 0) folder.elementIds = folderElements.map(element => element.id);
    if (folders.length > 0) folder.folders = folders;
    return folder;
  });
}

function readTopLevelFolder(value: unknown, path: string): ModelFolder {
  const source = readObject(value, path, folderSnapshotKeys);
  const elements: Element[] = [];
  const folders = readFolders(source.folders, `${path}.folders`, elements);
  elements.push(...readElements(source.elements, `${path}.elements`));
  const folder: ModelFolder = { ...readFolderDetails(source, path), elements };
  if (folders.length > 0) folder.folders = folders;
  return folder;
}

function readElement(value: unknown, path: string): Element {
  const source = readObject(value, path, elementKeys);
  const element = {} as Element;
  const id = readOptionalString(source.id, `${path}.id`);
  if (id !== undefined) element.id = id;
  element.name = readString(source.name, `${path}.name`);
  element.type = readString(source.type, `${path}.type`) as ArchimateModelType;
  const sourceId = readOptionalString(source.source, `${path}.source`);
  if (sourceId !== undefined) element.source = sourceId;
  const target = readOptionalString(source.target, `${path}.target`);
  if (target !== undefined) element.target = target;
  const documentation = readOptionalString(source.documentation, `${path}.documentation`);
  if (documentation !== undefined) element.documentation = documentation;
  element.properties = readOptionalEntries(source.properties, `${path}.properties`) ?? new Map();
  if (source.children !== undefined) element.child = readChildren(source.children, `${path}.children`);
  const profiles = readOptionalString(source.profiles, `${path}.profiles`);
  if (profiles !== undefined) element.profiles = profiles;
  readAttributes(element, source, viewAttributes, path);
  readAttributes(element, source, conceptAttributes, path);
  const features = readOptionalEntries(source.features, `${path}.features`);
  if (features) element.features = features;
  const unrecognized = readOpaque(source.unrecognized, `${path}.unrecognized`);
  if (unrecognized) element.unrecognized = unrecognized;
  return element;
}

function readChildren(value: unknown, path: string): Child[] {
  return readArray(value, path).map((child, i) => readChild(child, `${path}[${i}]`));
}

function readChild(value: unknown, path: string): Child {
  const source = readObject(value, path, childKeys);
  const child = {} as Child;
  const id = readOptionalString(source.id, `${path}.id`);
  if (id !== undefined) child.id = id;
  child.type = readString(source.type, `${path}.type`);
  readAttributes(child, source, childAttributes, path);
  const features = readOptionalEntries(source.features, `${path}.features`);
  Object.assign(child, DiagramAttributeMapper.readFeatures(features, childFeatures));
  const bounds = readObject(source.bounds, `${path}.bounds`, boundsKeySet);
  child.bounds = { x: 0, y: 0, width: 0, height: 0 };
  for (const key of boundsKeys) child.bounds[key] = readNumber(bounds[key], `${path}.bounds.${key}`);
  if (source.connections !== undefined) child.sourceConnection = readConnections(source.connections, `${path}.connections`);
  const properties = readOptionalEntries(source.properties, `${path}.properties`);
  if (properties) child.properties = properties;
  if (features) child.features = features;
  const unrecognized = readOpaque(source.unrecognized, `${path}.unrecognized`);
  if (unrecognized) child.unrecognized = unrecognized;
  for (const key of childTextElements) {
    const text = readOptionalString(source[key], `${path}.${key}`);
    if (text !== undefined) child[key] = text;
  }
  if (source.children !== undefined) child.child = readChildren(source.children, `${path}.children`);
  return child;
}

/**
 * One connection is read as an object and several as an array, as the Parser reads them from XML.
 */
function readConnections(value: unknown, path: string): SourceConnection | SourceConnection[] {
  const connections = readArray(value, path).map((connection, i) => readConnection(connection, `${path}[${i}]`));
  return connections.length === 1 ? connections[0] : connections;
}

function readConnection(value: unknown, path: string): SourceConnection {
  const source = readObject(value, path, connectionKeys);
  const connection = {} as SourceConnection;
  const id = readOptionalString(source.id, `${path}.id`);
  if (id !== undefined) connection.id = id;
  const relationship = readOptionalString(source.archimateRelationship, `${path}.archimateRelationship`);
  if (relationship !== undefined) connection.archimateRelationship = relationship;
  const sourceId = readOptionalString(source.source, `${path}.source`);
  if (sourceId !== undefined) connection.source = sourceId;
  const target = readOptionalString(source.target, `${path}.target`);
  if (target !== undefined) connection.target = target;
  connection.type = readString(source.type, `${path}.type`);
  readAttributes(connection, source, connectionAttributes, path);
  if (source.implicitType !== undefined) {
    if (source.implicitType !== true) fail(`${path}.implicitType`, 'expected true');
    connection.implicitType = true;
  }
  const documentation = readOptionalString(source.documentation, `${path}.documentation`);
  if (documentation !== undefined) connection.documentation = documentation;
  if (source.bendpoints !== undefined) {
    connection.bendpoints = readArray(source.bendpoints, `${path}.bendpoints`).map((item, i) => {
      const at = `${path}.bendpoints[${i}]`;
      const bendpoint = readObject(item, at, bendpointKeySet);
      const read = {} as ViewBendpoint;
      for (const key of bendpointKeys) read[key] = readNumber(bendpoint[key], `${at}.${key}`);
      return read;
    });
  }
  const properties = readOptionalEntries(source.properties, `${path}.properties`);
  if (properties) connection.properties = properties;
  const features = readOptionalEntries(source.features, `${path}.features`);
  if (features) {
    Object.assign(connection, DiagramAttributeMapper.readFeatures(features, connectionFeatures));
    connection.features = features;
  }
  if (source.connections !== undefined) connection.sourceConnection = readConnections(source.connections, `${path}.connections`);
  const unrecognized = readOpaque(source.unrecognized, `${path}.unrecognized`);
  if (unrecognized) connection.unrecognized = unrecognized;
  return connection;
}
