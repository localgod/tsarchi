import type { Model, FolderKey, ModelContent, ModelFolder, ModelFolderDetails } from './interfaces/Model.mjs';
import type { Profile } from './interfaces/Profile.mjs';
import type { Schema as ArchimateSchema } from './interfaces/schema/Schema.mjs';
import type { ModelAttributes } from './interfaces/schema/Model.mjs';
import type { XmlMetadata } from './interfaces/schema/XmlMetadata.mjs';
import type { Element } from './interfaces/Element.mjs';
import type { Folder, FolderDetails } from './interfaces/Folder.mjs';
import type { Relationship, RelationshipInput } from './interfaces/Relationship.mjs';
import type { Child } from './interfaces/Child.mjs';
import type { View } from './interfaces/View.mjs';
import type { SourceConnection } from './interfaces/SourceConnection.mjs';
import type { Bounds } from './interfaces/Bounds.mjs';
import type { DrawioOptions } from './interfaces/DrawioOptions.mjs';
import { ArchimateValidationError } from './interfaces/ValidationIssue.mjs';
import type { ValidationIssue, ValidationIssueCode } from './interfaces/ValidationIssue.mjs';
import { ArchimateParseError } from './interfaces/ArchimateParseError.mjs';
import { Parser } from './internal/Parser.mjs';
import { parseArchimateXml, buildArchimateXml } from './internal/Xml.mjs';
import { Serializer } from './internal/Serializer.mjs';
import { serializeDrawio } from './internal/DrawioSerializer.mjs';
import { ViewManager } from './internal/ViewManager.mjs';
import { ModelIndex, relationshipsByEndpoint } from './internal/ModelIndex.mjs';
import { removeFromNestedFolders } from './internal/NestedFolders.mjs';
import { toArray } from './internal/Arrays.mjs';
import { deepCopy } from './internal/Copy.mjs';
import { randomArchiId } from './internal/Ids.mjs';
import { readSnapshot, writeSnapshot } from './internal/Snapshot.mjs';
import type { ModelSnapshot } from './interfaces/ModelSnapshot.mjs';
import { splitIds } from './internal/ViewChildMapper.mjs';
import {
  folderType,
  elementTypeToFolderKey,
  isArchimateModelType,
  canvasModelTypes,
  archimateNamespace,
  canvasNamespace,
  allowedRelationshipTypes,
} from './constants/archimate-mappings.mjs';
import { relationshipMatrixKeys } from './internal/relationships-matrix.mjs';
import { AccessType, RelationshipDirection, TopLevelFolder, TraversalDirection } from './constants/archi-codes.mjs';
import { assertCode, assertOptionalCode } from './internal/Codes.mjs';
import type { ArchimateModelType, ArchimateRelationshipType } from './constants/archimate-mappings.mjs';

/**
 * Codes for models Archi opens and saves, but that break a naming convention or an ArchiMate rule
 * Archi only enforces when relationships are created, and for types tsarchi does not know, which are
 * saved unchanged. Every other code is an error.
 */
const warningIssueCodes = new Set<ValidationIssueCode>([
  'missing-name',
  'unknown-type',
  'relationship-endpoint-not-allowed',
  'relationship-type-not-allowed',
  'junction-relationship-type-mismatch',
]);

type PendingIssue = Omit<ValidationIssue, 'severity'>;

/** Relationship types the relationships matrix has rules for. */
const matrixRelationshipTypes: ReadonlySet<string> = new Set(Object.values(relationshipMatrixKeys));

/** A deep copy of a stored object, so that what the API returns cannot change the model. */
const copy = <T,>(value: T): T => deepCopy(value);

/**
 * A deep copy of a stored element, relationship or view, much faster than `copy` on large models. Most values are
 * strings, numbers and booleans; the Maps hold strings only, so a new Map is a deep copy. Any other object (a
 * view's `child` tree, `unrecognized`) is copied with `deepCopy`.
 */
const copyElement = <T extends Element>(element: T): T => {
  const result = { ...element } as Record<string, unknown>;
  for (const key in result) {
    const value = result[key];
    if (typeof value === 'object' && value !== null) result[key] = value instanceof Map ? new Map(value) : deepCopy(value);
  }
  return result as T;
};

/** Whether a folder holds ArchiMate elements, not relationships or views. */
const isConceptElement = (folderKey: FolderKey): boolean => folderKey !== 'relations' && folderKey !== 'diagrams';

/**
 * Ids a view's children and connections are checked against in validateModel.
 */
type ViewValidationIds = {
  modelElementIds: Set<string>;
  relationshipIds: Set<string>;
  viewIds: Set<string>;
  /** Diagram objects and connections in the view, which connections can start or end on. */
  endpointIds: Set<string>;
  connectionIds: Set<string>;
};

export class Archimate {
  /** Model-level content besides the folders: purpose, properties, metadata, profiles and unrecognised content. */
  private content: ModelContent;

  private xmlMetadata: XmlMetadata;

  private modelMetadata: ModelAttributes;

  private model: Model;

  private viewManager: ViewManager;

  /** Lookups by id; every change to the model below keeps it current. */
  private readonly index = new ModelIndex(
    () => this.model,
    () => this.content.profiles
  );

  public constructor() {
    this.content = {};
    this.xmlMetadata = this.defaultXmlMetadata();
    this.modelMetadata = this.defaultModelMetadata();
    this.model = this.init();
    this.viewManager = new ViewManager(this.model, () => this.generateUniqueId(), this.index);
  }

  private defaultXmlMetadata(): XmlMetadata {
    return { '@_version': '1.0', '@_encoding': 'UTF-8' };
  }

  private defaultModelMetadata(): ModelAttributes {
    return {
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@_xmlns:archimate': archimateNamespace,
      '@_name': '',
      '@_id': 'id-d81fe19001de4c3cb53c05c2b757d35d',
      '@_version': '5.0.0',
    };
  }

  private init(): Model {
    return Array.from(folderType.entries()).reduce((acc, [key, name]) => {
      acc[key as FolderKey] = {
        name,
        id: this.generateRandomId(),
        elements: [],
      };
      return acc;
    }, {} as Model);
  }

  private generateRandomId(): string {
    return randomArchiId();
  }

  /**
   * Returns true when an ID is already used by the model, folders, views,
   * diagram children, view connections or profiles.
   */
  public hasId(id: string): boolean {
    return !!id && this.index.hasId(id);
  }

  /**
   * Whether an element patch can add, remove or rename ids: those of a view's diagram children or connections,
   * or the element's own id.
   */
  private static patchChangesIds(element: Element, patch: Partial<Element>): boolean {
    return 'child' in patch || (patch.id !== undefined && patch.id !== element.id);
  }

  /**
   * Applies a patch to a stored element, relationship or view in place, as upsertElement and upsertRelationship do.
   */
  private updateInPlace(folderKey: FolderKey, element: Element, patch: Partial<Element>): void {
    const changesIds = Archimate.patchChangesIds(element, patch);
    Object.assign(element, this.mergeElementPatch(element, patch));
    if (changesIds) this.index.clear();
    else this.index.replaced(folderKey, folderKey, element);
  }

  /**
   * Generates an ID that is not currently used by the model.
   */
  public generateUniqueId(): string {
    let id = this.generateRandomId();

    while (this.hasId(id)) {
      id = this.generateRandomId();
    }

    return id;
  }

  /**
   * Inserts or updates an element in the appropriate folder.
   * Updates are matched on `id`. An element without an `id` is always added
   * with a new one: names are not unique in a model, so they are never matched.
   * Throws when the given `id` is already used by something other than an
   * element in the target folder.
   * Only provided properties are overwritten; others remain unchanged.
   * The model stores a copy: the given object is not changed or kept.
   * @param element Partial or full element data to insert or update.
   * @returns A copy of the inserted or updated element.
   */
  public upsertElement(element: Partial<Element> & Pick<Element, 'name' | 'type'>): Element {
    const folderKey = elementTypeToFolderKey.get(element.type);

    if (!folderKey) {
      throw new Error(`Unknown element type "${element.type}".`);
    }

    const folder = this.model[folderKey];

    if (!folder.elements) {
      folder.elements = [];
    }

    const entry = element.id ? this.index.element(element.id) : undefined;
    const existingElement = entry?.folderKey === folderKey ? entry.element : undefined;

    if (!existingElement && element.id && this.hasId(element.id)) {
      throw new Error(`ID "${element.id}" is already in use.`);
    }

    if (existingElement) {
      // The element is updated in place.
      this.updateInPlace(folderKey, existingElement, element);
      return copyElement(existingElement);
    }
    // The model keeps its own copy, so the caller's object is left as it was and later changes to it are not seen.
    const newElement: Element = { ...deepCopy(element), id: element.id || this.generateUniqueId() };
    folder.elements.push(newElement);
    this.index.added(folderKey, newElement);
    return copyElement(newElement);
  }

  /**
   * Finds an element with the given name within a specific folder.
   * @param folderKey The key of the folder to search within.
   * @param elementName The name of the element to find.
   * @returns A copy of the element if found, otherwise null.
   */
  public findElementInFolderByName(folderKey: FolderKey, elementName: string): Element | null {
    const element = this.model[folderKey]?.elements?.find(el => el.name === elementName);
    return element ? copyElement(element) : null;
  }

  /**
   * Retrieves a copy of an element, relationship or view by ID from any folder. Change it with `updateElement`.
   */
  public getElement(elementId: string): Element | null {
    const element = this.index.element(elementId)?.element;
    return element ? copyElement(element) : null;
  }

  /**
   * Finds copies of all elements with a matching name across all folders.
   */
  public findElementsByName(elementName: string): Element[] {
    return this.allElements()
      .filter(el => el.name === elementName)
      .map(copyElement);
  }

  /**
   * Updates an element by ID.
   *
   * If the type changes, the element is moved to the appropriate folder.
   * Relationship source/target and IDs are preserved unless explicitly patched.
   * A key set to undefined removes that field (`name` becomes empty; `id` and `type` are kept); keys left out are unchanged.
   * `properties` is merged into the existing properties, so set it to undefined to remove them all.
   * Returns a copy of the updated element.
   */
  public updateElement(elementId: string, patch: Partial<Omit<Element, 'id'>>): Element | null {
    const location = this.findElementLocationById(elementId);
    if (!location) return null;

    const nextType = patch.type ?? location.element.type;
    // An element of a type it does not know (kept from the file) stays in its folder unless its type changes
    const nextFolderKey = nextType === location.element.type ? location.folderKey : elementTypeToFolderKey.get(nextType);
    if (!nextFolderKey) {
      throw new Error(`Unknown element type "${nextType}".`);
    }

    const changesIds = Archimate.patchChangesIds(location.element, patch);
    const updatedElement = this.mergeElementPatch(location.element, patch, true);

    if (nextFolderKey === location.folderKey) {
      location.folder.elements![location.index] = updatedElement;
    } else {
      location.folder.elements!.splice(location.index, 1);
      removeFromNestedFolders(location.folder.folders || [], new Set([elementId]));
      const nextFolder = this.model[nextFolderKey];
      if (!nextFolder.elements) nextFolder.elements = [];
      nextFolder.elements.push(updatedElement);
    }
    if (changesIds) this.index.clear();
    else this.index.replaced(location.folderKey, nextFolderKey, updatedElement);

    return copyElement(updatedElement);
  }

  /**
   * Deletes an element or relationship by ID.
   *
   * Deleting a model element also removes relationships pointing at it and
   * diagram objects that reference it. Deleting a relationship removes view
   * connections that reference it. Relationships attached to a removed
   * relationship are removed as well.
   */
  public deleteElement(elementId: string): boolean {
    const location = this.findElementLocationById(elementId, true);
    if (!location) return false;

    location.folder.elements!.splice(location.index, 1);
    this.removeWithDeletedElements(new Map([[location.folderKey, new Set([elementId])]]));
    this.index.clear();
    return true;
  }

  /**
   * Deletes several elements, relationships or views at once, removing the same as calling `deleteElement` for each of
   * them, but in one pass over the model and its views instead of one per id. Ids not found, including those of
   * relationships already removed with an element in the list, are skipped. Returns the ids that were found.
   */
  public deleteElements(elementIds: Iterable<string>): string[] {
    const deleted = new Map<FolderKey, Set<Element>>();
    const found: string[] = [];
    for (const id of new Set(elementIds)) {
      const entry = this.index.element(id);
      if (!entry) continue;
      found.push(id);
      const elements = deleted.get(entry.folderKey) ?? new Set();
      elements.add(entry.element);
      deleted.set(entry.folderKey, elements);
    }
    if (found.length === 0) return found;

    const deletedIds = new Map<FolderKey, Set<string>>();
    for (const [folderKey, elements] of deleted) {
      const folder = this.model[folderKey];
      folder.elements = folder.elements!.filter(element => !elements.has(element));
      deletedIds.set(folderKey, new Set(Array.from(elements, element => element.id)));
    }
    this.removeWithDeletedElements(deletedIds);
    this.index.clear();
    return found;
  }

  /**
   * Removes what goes with elements or relationships deleted from top-level folders: their places in nested
   * folders, the relationships attached to them (transitively), and the diagram objects and view connections
   * that show any of them.
   */
  private removeWithDeletedElements(deletedIds: ReadonlyMap<FolderKey, ReadonlySet<string>>): void {
    const elementIds = new Set<string>();
    const removedRelationshipIds = new Set<string>();
    for (const [folderKey, ids] of deletedIds) {
      removeFromNestedFolders(this.model[folderKey].folders || [], ids);
      for (const id of ids) (folderKey === 'relations' ? removedRelationshipIds : elementIds).add(id);
    }

    for (const relationship of this.removeRelationshipsForElements(new Set([...elementIds, ...removedRelationshipIds]))) {
      removedRelationshipIds.add(relationship.id);
    }
    if (removedRelationshipIds.size > 0) {
      removeFromNestedFolders(this.model.relations.folders || [], removedRelationshipIds);
      this.removeViewConnectionsForRelationships(removedRelationshipIds);
    }
    if (elementIds.size > 0) {
      this.removeViewChildren(
        child => child.type === 'DiagramObject' && child.archimateElement !== undefined && elementIds.has(child.archimateElement)
      );
    }
  }

  /**
   * Inserts or updates a relationship in the relations folder.
   *
   * Updates are matched on `id`. A relationship without an `id` is always added with a new one.
   * Returns a copy of the inserted or updated relationship.
   */
  public upsertRelationship(relationship: RelationshipInput): Relationship {
    this.assertRelationshipType(relationship.type);
    assertOptionalCode('accessType', relationship.accessType, AccessType);
    const source = this.relationshipEndpoint(relationship.source, 'source');
    const target = this.relationshipEndpoint(relationship.target, 'target');
    const typeIssue = this.relationshipTypeIssue(
      relationship,
      source,
      target,
      id => this.index.element(id)?.element,
      id => this.index.relationshipsOf(id)
    );
    if (typeIssue) throw new Error(typeIssue.message);

    const folder = this.model.relations;
    if (!folder.elements) folder.elements = [];

    const entry = relationship.id ? this.index.element(relationship.id) : undefined;
    const existingRelationship = entry?.folderKey === 'relations' ? (entry.element as Relationship) : undefined;

    if (!existingRelationship && relationship.id && this.hasId(relationship.id)) {
      throw new Error(`ID "${relationship.id}" is already in use.`);
    }

    if (existingRelationship) {
      this.updateInPlace('relations', existingRelationship, relationship);
      return copyElement(existingRelationship);
    }

    const newRelationship: Relationship = {
      id: relationship.id || this.generateUniqueId(),
      name: relationship.name,
      type: relationship.type,
      source: relationship.source,
      target: relationship.target,
      documentation: relationship.documentation,
      properties: relationship.properties,
    };
    if (relationship.accessType !== undefined) newRelationship.accessType = relationship.accessType;
    if (relationship.directed !== undefined) newRelationship.directed = relationship.directed;
    if (relationship.strength !== undefined) newRelationship.strength = relationship.strength;
    if (relationship.profiles !== undefined) newRelationship.profiles = relationship.profiles;
    if (relationship.features !== undefined) newRelationship.features = relationship.features;
    // Maps and arrays are copied, so later changes to the caller's input are not seen.
    const storedRelationship = deepCopy(newRelationship);
    folder.elements.push(storedRelationship);
    this.index.added('relations', storedRelationship);
    return copyElement(storedRelationship);
  }

  /**
   * Lists copies of all elements in the model, in folder order, including those in nested folders. Relationships
   * and views are left out.
   */
  public listElements(): Element[] {
    return (Object.keys(this.model) as FolderKey[])
      .filter(folderKey => folderKey !== 'relations' && folderKey !== 'diagrams')
      .flatMap(folderKey => this.model[folderKey].elements || [])
      .map(copyElement);
  }

  /**
   * Lists copies of all relationships in the model, including those in nested folders.
   */
  public listRelationships(): Relationship[] {
    return (this.model.relations.elements || []).map(copyElement) as Relationship[];
  }

  /**
   * Retrieves a copy of a relationship by ID.
   */
  public getRelationship(relationshipId: string): Relationship | null {
    const entry = this.index.element(relationshipId);
    return entry?.folderKey === 'relations' ? (copyElement(entry.element) as Relationship) : null;
  }

  /**
   * Finds copies of the relationships connected to an element.
   */
  public findRelationshipsForElement(elementId: string, direction: 'source' | 'target' | 'both' = 'both'): Relationship[] {
    assertCode('direction', direction, RelationshipDirection);
    return this.relationshipsForElement(elementId, direction).map(copyElement);
  }

  /**
   * The stored relationships connected to an element.
   */
  private relationshipsForElement(elementId: string, direction: 'source' | 'target' | 'both'): Relationship[] {
    const relationships = this.index.relationshipsOf(elementId);
    if (direction === 'both') return relationships;
    return relationships.filter(relationship => relationship[direction] === elementId);
  }

  /**
   * Finds copies of the relationships between two elements.
   */
  public findRelationshipsBetween(
    sourceElementId: string,
    targetElementId: string,
    options?: {
      bidirectional?: boolean;
      type?: ArchimateRelationshipType;
    }
  ): Relationship[] {
    if (options?.type !== undefined) this.assertRelationshipType(options.type);
    return (this.model.relations.elements || [])
      .filter(relationship => {
        const directMatch = relationship.source === sourceElementId && relationship.target === targetElementId;
        const reverseMatch =
          options?.bidirectional === true && relationship.source === targetElementId && relationship.target === sourceElementId;
        const typeMatch = options?.type ? relationship.type === options.type : true;

        return typeMatch && (directMatch || reverseMatch);
      })
      .map(copyElement) as Relationship[];
  }

  /**
   * Finds copies of the elements reachable from an element within `hops` relationships: the start element first, then
   * the others by distance, each once. `hops` is a whole number of 0 or more, or `Infinity` for everything connected.
   * `direction` follows relationships from source to target (`outgoing`), the other way (`incoming`) or either way
   * (`both`, the default); `relationshipTypes` follows only relationships of these types. Relationships that end on
   * another relationship are not followed. Throws on an unknown start id, a start that is a relationship or view, an
   * invalid `hops`, or an unknown direction or relationship type, so a misspelt one fails instead of finding nothing.
   */
  public findReachableElements(
    elementId: string,
    hops: number,
    options?: {
      relationshipTypes?: ArchimateRelationshipType[];
      direction?: 'outgoing' | 'incoming' | 'both';
    }
  ): Element[] {
    const start = this.index.element(elementId);
    if (!start) throw new Error(`Element with ID ${elementId} not found in model`);
    if (!isConceptElement(start.folderKey)) {
      throw new Error(`Element ${elementId} has type ${start.element.type}, which is not an element type`);
    }
    if (!(Number.isInteger(hops) && hops >= 0) && hops !== Infinity) {
      throw new Error(`Invalid hops ${JSON.stringify(hops)}; expected a whole number of 0 or more, or Infinity.`);
    }
    const direction = options?.direction ?? TraversalDirection.Both;
    assertCode('direction', direction, TraversalDirection);
    let types: Set<string> | undefined;
    if (options?.relationshipTypes !== undefined) {
      if (!Array.isArray(options.relationshipTypes)) throw new Error('relationshipTypes must be an array of relationship types.');
      for (const type of options.relationshipTypes) this.assertRelationshipType(type);
      types = new Set(options.relationshipTypes);
    }

    const end = direction === 'outgoing' ? 'source' : direction === 'incoming' ? 'target' : 'both';
    const found = new Map<string, Element>([[elementId, start.element]]);
    let frontier = [elementId];
    for (let hop = 0; hop < hops && frontier.length > 0; hop++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const relationship of this.relationshipsForElement(id, end)) {
          if (types && !types.has(relationship.type)) continue;
          const otherId = relationship.source === id ? relationship.target : relationship.source;
          if (found.has(otherId)) continue;
          const other = this.index.element(otherId);
          if (!other || !isConceptElement(other.folderKey)) continue;
          found.set(otherId, other.element);
          next.push(otherId);
        }
      }
      frontier = next;
    }
    return [...found.values()].map(copyElement);
  }

  /**
   * Deletes a relationship and removes matching view connections.
   */
  public deleteRelationship(relationshipId: string): boolean {
    const relationship = this.model.relations.elements?.find(el => el.id === relationshipId);
    if (!relationship) return false;
    return this.deleteElement(relationshipId);
  }

  /**
   * Validates model references and required fields before serialization.
   */
  public validateModel(): ValidationIssue[] {
    const issues: PendingIssue[] = [];
    const seenIds = new Map<string, string>();
    const modelElementIds = new Set<string>();
    const relationshipIds = new Set<string>();
    const endpoints = new Map<string, Element>();

    const profileIds = new Set<string>();
    for (const [index, profile] of (this.content.profiles || []).entries()) {
      this.recordId(profile.id, `profiles[${index}]`, seenIds, issues);
      profileIds.add(profile.id);
    }

    for (const folderKey of Object.keys(this.model) as FolderKey[]) {
      const folder = this.model[folderKey];
      this.recordId(folder.id, `folder.${folderKey}`, seenIds, issues);
      this.recordFolderIds(folder.folders || [], `folder.${folderKey}`, seenIds, issues);

      for (const [index, element] of (folder.elements || []).entries()) {
        const path = `folder.${folderKey}.elements[${index}]`;
        this.validateElementFields(element, path, issues);
        this.validateElementProfiles(element, path, profileIds, issues);
        this.recordId(element.id, path, seenIds, issues);

        if (folderKey === 'relations') {
          relationshipIds.add(element.id);
        } else if (folderKey !== 'diagrams') {
          modelElementIds.add(element.id);
        }
        if (folderKey !== 'diagrams' && element.id && !endpoints.has(element.id)) {
          endpoints.set(element.id, element);
        }
      }
    }

    this.validateRelationships(endpoints, issues);
    this.validateViews(modelElementIds, relationshipIds, seenIds, issues);

    return issues.map(issue => ({
      ...issue,
      severity: warningIssueCodes.has(issue.code) ? 'warning' : 'error',
    }));
  }

  /**
   * Throws an ArchimateValidationError if validateModel finds errors. Warnings do not block saving.
   */
  public assertValidModel(): void {
    const errors = this.validateModel().filter(issue => issue.severity === 'error');
    if (errors.length > 0) {
      throw new ArchimateValidationError(errors);
    }
  }

  private parse(input: ArchimateSchema): void {
    const parser = new Parser(this.model);
    this.model = parser.parse(input);
    this.index.clear();
    this.content = parser.parseModelContent(input);
    this.xmlMetadata = input['?xml'] || this.defaultXmlMetadata();
    const namespaces = Object.fromEntries(
      Object.entries(input['archimate:model'] ?? {}).filter(([key, value]) => key.startsWith('@_xmlns:') && value)
    );
    const root = input['archimate:model'];
    this.modelMetadata = this.rootAttributes(namespaces, root?.['@_name'] ?? '', root?.['@_id'], root?.['@_version']);
  }

  /**
   * The model's root attributes from what a file or snapshot declares, with defaults for a missing id or version.
   */
  private rootAttributes(
    namespaces: Record<string, string>,
    name: string,
    id: string | undefined,
    version: string | undefined
  ): ModelAttributes {
    const defaultModelMetadata = this.defaultModelMetadata();
    return {
      ...defaultModelMetadata,
      ...namespaces,
      '@_name': name,
      '@_id': id || defaultModelMetadata['@_id'],
      '@_version': version || defaultModelMetadata['@_version'],
    };
  }

  /**
   * Returns the model as plain, JSON-safe data, for undo steps, copies and comparisons without going through XML.
   * The format is unstable and meant for use within one tsarchi version; see ModelSnapshot. Two models that toXml()
   * would write the same way give the same snapshot, so `JSON.stringify` of two snapshots can be compared.
   * The snapshot is new data: changing it does not change the model.
   */
  public snapshot(): ModelSnapshot {
    return writeSnapshot(
      this.model,
      this.content,
      this.xmlMetadata,
      this.withRequiredNamespaces(this.modelMetadata),
      this.defaultModelMetadata()
    );
  }

  /**
   * Replaces this model's content with a snapshot from snapshot(), as fromXml() would load the same model.
   * The model keeps no reference to the snapshot. Like fromXml(), it does not validate the model.
   * Throws an ArchimateParseError (`invalid-structure`) when the value is not a snapshot of a known version,
   * and leaves the model unchanged.
   */
  public restore(snapshot: ModelSnapshot): void {
    const { model, content, xmlMetadata, root } = readSnapshot(snapshot);
    this.model = model;
    this.content = content;
    this.index.clear();
    this.xmlMetadata = xmlMetadata;
    this.modelMetadata = this.rootAttributes(root.namespaces, root.name, root.id, root.version);
    this.viewManager = new ViewManager(this.model, () => this.generateUniqueId(), this.index);
  }

  /**
   * Creates a model from a snapshot from snapshot(). Throws as restore() does.
   */
  public static fromSnapshot(snapshot: ModelSnapshot): Archimate {
    const archimate = new Archimate();
    archimate.restore(snapshot);
    return archimate;
  }

  /**
   * Loads a model from the text of an .archimate file.
   * Throws an ArchimateParseError when the text is not XML (`not-xml`), has no `<archimate:model>` root
   * (`not-archimate`), or its content cannot be read as a model (`invalid-structure`).
   */
  public static fromXml(text: string): Archimate {
    const schema = parseArchimateXml(text);
    const archimate = new Archimate();
    try {
      archimate.parse(schema);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ArchimateParseError('invalid-structure', `Could not read the Archi model: ${reason}`, { cause: error });
    }
    return archimate;
  }

  /**
   * Returns the model as the text of an .archimate file.
   * Throws an ArchimateValidationError if validateModel finds errors, as saving does.
   */
  public toXml(): string {
    this.assertValidModel();
    return buildArchimateXml(this.serialize());
  }

  /**
   * Returns a view as the text of a draw.io file (mxGraph XML), one page named after the view. Diagram objects,
   * groups and notes become vertices with their bounds, nested ones inside their parent, and connections become
   * edges with their bendpoints and their relationship's line style. Cell ids are the diagram object and connection
   * ids. The export is one-way: draw.io files cannot be read back.
   * Throws if the model has no view with this id.
   */
  public toDrawio(viewId: string, options: DrawioOptions = {}): string {
    const view = this.viewManager.getView(viewId);
    if (!view) throw new Error(`View with ID ${viewId} not found in model`);
    return serializeDrawio(
      view,
      id => this.index.element(id)?.element,
      options,
      id => this.index.hasId(id)
    );
  }

  private serialize(): ArchimateSchema {
    const serializer = new Serializer(this.model);
    return serializer.serialize(this.withRequiredNamespaces(this.modelMetadata), this.xmlMetadata, this.content);
  }

  /**
   * Returns the model's name.
   */
  public getName(): string {
    return this.modelMetadata['@_name'] ?? '';
  }

  /**
   * Sets the model's name.
   */
  public setName(name: string): void {
    this.modelMetadata['@_name'] = name;
  }

  /**
   * Returns the model's id.
   */
  public getId(): string {
    return this.modelMetadata['@_id'];
  }

  /**
   * Returns the version of the model's file format, as written by Archi (for example `5.0.0`).
   */
  public getVersion(): string {
    return this.modelMetadata['@_version'];
  }

  /**
   * Returns the model's purpose text, if any.
   */
  public getPurpose(): string | undefined {
    return this.content.purpose;
  }

  /**
   * Sets the model's purpose text. Pass undefined or an empty string to remove it.
   */
  public setPurpose(purpose: string | undefined): void {
    this.content.purpose = purpose || undefined;
  }

  /**
   * Returns a copy of the model's own properties, in file order.
   */
  public getProperties(): Map<string, string> {
    return new Map(this.content.properties);
  }

  /**
   * Replaces the model's own properties. Pass undefined or an empty map to remove them.
   */
  public setProperties(properties: Map<string, string> | undefined): void {
    this.content.properties = properties && properties.size > 0 ? new Map(properties) : undefined;
  }

  /**
   * Returns a copy of the entries of the model's `<metadata>`, in file order.
   */
  public getMetadata(): Map<string, string> {
    return new Map(this.content.metadata);
  }

  /**
   * Replaces the entries of the model's `<metadata>`. Pass undefined to remove the element; an empty map
   * writes an empty `<metadata/>`.
   */
  public setMetadata(metadata: Map<string, string> | undefined): void {
    this.content.metadata = metadata ? new Map(metadata) : undefined;
  }

  /**
   * Returns copies of the specializations defined on the model, in file order.
   */
  public getProfiles(): Profile[] {
    return (this.content.profiles ?? []).map(copy);
  }

  /**
   * Returns a copy of the profile with the given id, or null.
   */
  public getProfile(profileId: string): Profile | null {
    const profile = this.content.profiles?.find(profile => profile.id === profileId);
    return profile ? copy(profile) : null;
  }

  /**
   * Replaces the specializations defined on the model. Elements and relationships refer to them by id through
   * `Element.profiles`; validateModel() reports references to profiles that do not exist.
   */
  public setProfiles(profiles: Profile[] | undefined): void {
    this.content.profiles = profiles && profiles.length > 0 ? profiles.map(copy) : undefined;
    this.index.clear();
  }

  /**
   * Declares the canvas namespace when the model contains canvas views, as their xsi:type values depend on it.
   */
  private withRequiredNamespaces(metadata: ModelAttributes): ModelAttributes {
    if (metadata['@_xmlns:canvas'] || !this.usesCanvasTypes()) {
      return metadata;
    }
    const { '@_xmlns:xsi': xsi, '@_xmlns:archimate': archimate, ...rest } = metadata;
    return { '@_xmlns:xsi': xsi, '@_xmlns:archimate': archimate, '@_xmlns:canvas': canvasNamespace, ...rest };
  }

  private usesCanvasTypes(): boolean {
    const canvasTypes: readonly string[] = canvasModelTypes;
    const hasCanvasType = (children: Child[] | Child | undefined): boolean =>
      toArray(children).some(child => canvasTypes.includes(child.type) || hasCanvasType(child.child));
    return (this.model.diagrams.elements || []).some(view => canvasTypes.includes(view.type) || hasCanvasType(view.child));
  }

  // View Management API

  /**
   * Creates a new view with the specified name and optional properties
   */
  public createView(
    name: string,
    options?: {
      viewpoint?: string;
      background?: number;
      documentation?: string;
    }
  ): View {
    return this.viewManager.createView(name, options);
  }

  /**
   * Retrieves a view by ID
   */
  public getView(viewId: string): View | null {
    return this.viewManager.getView(viewId);
  }

  /**
   * Lists all views in the model (ArchiMate, sketch and canvas), optionally only those of one type
   */
  public listViews(options?: { type?: View['type'] }): View[] {
    return this.viewManager.listViews(options);
  }

  /**
   * Adds a diagram object to a view, representing a model element
   */
  public addDiagramObject(
    viewId: string,
    elementId: string,
    bounds: Bounds,
    options?: {
      fillColor?: string;
      lineColor?: string;
      fontColor?: string;
      textAlignment?: number;
      figure?: number;
    }
  ) {
    return this.viewManager.addDiagramObject(viewId, elementId, bounds, options);
  }

  /**
   * Creates a group in a view to organize diagram objects
   */
  public addGroup(
    viewId: string,
    name: string,
    bounds: Bounds,
    options?: {
      fillColor?: string;
      lineColor?: string;
      textAlignment?: number;
      documentation?: string;
    }
  ) {
    return this.viewManager.addGroup(viewId, name, bounds, options);
  }

  /**
   * Adds a diagram object to a group within a view
   */
  public addDiagramObjectToGroup(
    viewId: string,
    groupId: string,
    elementId: string,
    bounds: Bounds,
    options?: {
      fillColor?: string;
      lineColor?: string;
      fontColor?: string;
      textAlignment?: number;
      figure?: number;
    }
  ) {
    return this.viewManager.addDiagramObjectToGroup(viewId, groupId, elementId, bounds, options);
  }

  /**
   * Creates a connection between two diagram objects in a view
   */
  public addConnection(
    viewId: string,
    sourceObjectId: string,
    targetObjectId: string,
    relationshipId?: string,
    options?: {
      lineColor?: string;
      lineWidth?: number;
      fontColor?: string;
      textPosition?: number;
    }
  ) {
    return this.viewManager.addConnection(viewId, sourceObjectId, targetObjectId, relationshipId, options);
  }

  /**
   * Updates visual properties of a diagram object. `figure` switches an ArchiMate diagram object between its box
   * (`DiagramObjectFigure.Default`) and Archi's alternate figure (`DiagramObjectFigure.Alternate`); it throws for any
   * other kind of diagram child, such as a group or note.
   */
  public updateDiagramObjectStyle(
    viewId: string,
    objectId: string,
    style: {
      fillColor?: string;
      lineColor?: string;
      fontColor?: string;
      bounds?: Bounds;
      textAlignment?: number;
      figure?: number;
    }
  ): boolean {
    return this.viewManager.updateDiagramObjectStyle(viewId, objectId, style);
  }

  /**
   * Removes a view from the model, together with the diagram model references to it in other views
   * and the connections attached to those references, as Archi does.
   */
  public deleteView(viewId: string): boolean {
    if (!this.viewManager.deleteView(viewId)) return false;
    this.removeDiagramModelReferences(viewId);
    this.index.clear();
    return true;
  }

  /**
   * Finds copies of the elements, relationships and views of a type. Throws on a type that is not an ArchiMate element,
   * relationship or view type, so a misspelt type fails instead of returning no elements.
   */
  public findElementsByType(elementType: ArchimateModelType): Element[] {
    if (!isArchimateModelType(elementType)) {
      throw new Error(`Unknown element type "${elementType}".`);
    }
    return this.allElements()
      .filter(el => el.type === elementType)
      .map(copyElement);
  }

  /**
   * Every element, relationship and view, in folder order.
   */
  private allElements(): Element[] {
    return Object.values(this.model).flatMap(folder => folder.elements || []);
  }

  /**
   * Finds copies of the elements, relationships or views in a top-level folder, including its nested folders
   */
  public findElementsByFolder(folderKey: FolderKey): Element[] {
    return (this.topLevelFolder(folderKey).elements || []).map(copyElement);
  }

  /**
   * Returns copies of the nested folders of a top-level folder, in document order. Change them with the folder
   * methods.
   *
   * Elements in nested folders are also included in `findElementsByFolder`;
   * a nested folder lists the ids of the elements placed directly in it.
   */
  public getFolders(folderKey: FolderKey): Folder[] {
    return (this.topLevelFolder(folderKey).folders || []).map(copy);
  }

  /**
   * Returns the id, name, documentation, properties and features of a top-level folder. Maps are copies;
   * use `updateFolder` to change them.
   */
  public getFolder(folderKey: FolderKey): ModelFolderDetails {
    return Archimate.folderDetails(this.topLevelFolder(folderKey));
  }

  /**
   * Updates the name, documentation, properties or features of a top-level folder and returns its new details.
   * A key set to undefined, an empty string or an empty map removes that detail; keys left out are unchanged.
   */
  public updateFolder(folderKey: FolderKey, patch: Partial<Omit<ModelFolderDetails, 'id'>>): ModelFolderDetails {
    return Archimate.applyFolderPatch(this.topLevelFolder(folderKey), patch);
  }

  /**
   * Returns the id, name, documentation, properties and features of the folder with the given id, top-level or
   * nested at any depth, or null when there is none. Maps are copies; use `updateFolderById` to change them.
   */
  public getFolderById(folderId: string): FolderDetails | null {
    const folder = this.findFolderById(folderId);
    return folder ? Archimate.folderDetails(folder) : null;
  }

  /**
   * Updates the name, documentation, properties or features of the folder with the given id, top-level or nested
   * at any depth, and returns its new details. A key set to undefined, an empty string or an empty map removes that
   * detail; keys left out are unchanged. Throws when there is no folder with that id.
   */
  public updateFolderById(folderId: string, patch: Partial<Omit<FolderDetails, 'id'>>): FolderDetails {
    const folder = this.findFolderById(folderId);
    if (!folder) throw new Error(`Folder "${folderId}" not found in model.`);
    return Archimate.applyFolderPatch(folder, patch);
  }

  /**
   * Creates a folder inside the folder with the given id, top-level or nested at any depth, and returns its details.
   * The new folder is added after the parent's existing subfolders. Its id is generated unless one is given; throws
   * when the parent does not exist, the name is empty or the id is already used.
   */
  public createFolder(parentFolderId: string, details: Omit<FolderDetails, 'id'> & { id?: string }): FolderDetails {
    const parent = this.locateFolder(parentFolderId);
    if (!parent) throw new Error(`Folder "${parentFolderId}" not found in model.`);
    if (details.id !== undefined && (!details.id || this.hasId(details.id))) {
      throw new Error(`Id "${details.id}" is empty or already used in the model.`);
    }

    const { id, name, documentation, properties, features } = details;
    const folder: Folder = { id: id ?? this.generateUniqueId(), name: '' };
    Archimate.applyFolderPatch(folder, { name, documentation, properties, features });
    if (!parent.folder.folders) parent.folder.folders = [];
    parent.folder.folders.push(folder);
    this.index.addId(folder.id);
    return Archimate.folderDetails(folder);
  }

  /**
   * Moves a nested folder, with its elements and subfolders, into another folder of the same top-level folder,
   * after that folder's existing subfolders. As in Archi, a folder cannot move to another top-level folder or into
   * itself. Throws when either folder does not exist, the folder is top-level, or the move is not allowed.
   */
  public moveFolder(folderId: string, parentFolderId: string): void {
    const location = this.locateFolder(folderId);
    if (!location) throw new Error(`Folder "${folderId}" not found in model.`);
    if (!location.parent) throw new Error(`Folder "${folderId}" is a top-level folder and cannot be moved.`);
    const target = this.locateFolder(parentFolderId);
    if (!target) throw new Error(`Folder "${parentFolderId}" not found in model.`);
    if (target.folderKey !== location.folderKey) {
      throw new Error(`Folder "${folderId}" cannot be moved to another top-level folder.`);
    }
    if (target.path.includes(location.folder)) {
      throw new Error(`Folder "${folderId}" cannot be moved into itself.`);
    }
    if (target.folder === location.parent) return;

    location.parent.folders = location.parent.folders!.filter(folder => folder !== location.folder);
    if (!target.folder.folders) target.folder.folders = [];
    target.folder.folders.push(location.folder as Folder);
  }

  /**
   * Deletes a nested folder together with its contents, as Archi does: its subfolders, the elements, relationships
   * or views placed in them, and everything `deleteElement` and `deleteView` remove along with those. Returns false
   * when there is no folder with that id; throws when it is a top-level folder.
   */
  public deleteFolder(folderId: string): boolean {
    const location = this.locateFolder(folderId);
    if (!location) return false;
    if (!location.parent) throw new Error(`Folder "${folderId}" is a top-level folder and cannot be deleted.`);

    location.parent.folders = location.parent.folders!.filter(folder => folder !== location.folder);

    const topLevel = this.model[location.folderKey];
    const topLevelIds = new Set((topLevel.elements || []).map(element => element.id));
    const collect = (folder: Folder): string[] => [...(folder.elementIds || []), ...(folder.folders || []).flatMap(collect)];
    const deletedIds = new Set(collect(location.folder as Folder).filter(id => topLevelIds.has(id)));
    if (deletedIds.size === 0) {
      this.index.clear();
      return true;
    }

    // Everything is deleted at once, which removes the same as deleting each element or view in turn.
    if (location.folderKey === 'diagrams') {
      for (const id of deletedIds) this.viewManager.deleteView(id);
      this.removeViewChildren(child => child.type === 'DiagramModelReference' && child.model !== undefined && deletedIds.has(child.model));
    } else {
      const elements = topLevel.elements!;
      let kept = 0;
      for (const element of elements) {
        if (!deletedIds.has(element.id)) elements[kept++] = element;
      }
      elements.length = kept;
      this.removeWithDeletedElements(new Map([[location.folderKey, deletedIds]]));
    }
    this.index.clear();
    return true;
  }

  /**
   * Moves an element, relationship or view into the folder with the given id, nested at any depth or top-level. The
   * folder must belong to the same top-level folder as the element, as in Archi. The element is placed after the
   * folder's existing elements. Throws when the element or folder does not exist or the move is not allowed.
   */
  public moveElementToFolder(elementId: string, folderId: string): void {
    const element = this.findElementLocationById(elementId);
    if (!element) throw new Error(`Element "${elementId}" not found in model.`);
    const target = this.locateFolder(folderId);
    if (!target) throw new Error(`Folder "${folderId}" not found in model.`);
    if (target.folderKey !== element.folderKey) {
      throw new Error(`Element "${elementId}" cannot be moved to a folder outside "${element.folder.name}".`);
    }

    removeFromNestedFolders(element.folder.folders || [], new Set([elementId]));
    if (target.parent) {
      const folder = target.folder as Folder;
      folder.elementIds = [...(folder.elementIds || []), elementId];
    }
  }

  private findFolderById(folderId: string): ModelFolder | Folder | undefined {
    return this.locateFolder(folderId)?.folder;
  }

  /**
   * Finds a folder by id, with the key of its top-level folder, its parent (undefined for a top-level folder) and
   * the chain of folders from the top-level folder down to it.
   */
  private locateFolder(folderId: string):
    | {
        folderKey: FolderKey;
        folder: ModelFolder | Folder;
        parent?: ModelFolder | Folder;
        path: Array<ModelFolder | Folder>;
      }
    | undefined {
    if (!folderId) return undefined;
    const search = (folders: Folder[], path: Array<ModelFolder | Folder>): Array<ModelFolder | Folder> | undefined => {
      for (const folder of folders) {
        const found = folder.id === folderId ? [...path, folder] : search(folder.folders || [], [...path, folder]);
        if (found) return found;
      }
      return undefined;
    };
    for (const folderKey of Object.keys(this.model) as FolderKey[]) {
      const topLevel = this.model[folderKey];
      const path = topLevel.id === folderId ? [topLevel] : search(topLevel.folders || [], [topLevel]);
      if (path) return { folderKey, folder: path[path.length - 1], parent: path[path.length - 2], path };
    }
    return undefined;
  }

  private static applyFolderPatch(folder: ModelFolder | Folder, patch: Partial<Omit<FolderDetails, 'id'>>): FolderDetails {
    if ('name' in patch) {
      if (!patch.name) throw new Error('A folder name cannot be empty.');
      folder.name = patch.name;
    }
    if ('documentation' in patch) folder.documentation = patch.documentation || undefined;
    if ('properties' in patch) folder.properties = patch.properties?.size ? new Map(patch.properties) : undefined;
    if ('features' in patch) folder.features = patch.features?.size ? new Map(patch.features) : undefined;
    return Archimate.folderDetails(folder);
  }

  private static folderDetails({ id, name, documentation, properties, features }: ModelFolder | Folder): FolderDetails {
    return {
      id,
      name,
      ...(documentation !== undefined && { documentation }),
      ...(properties && { properties: new Map(properties) }),
      ...(features && { features: new Map(features) }),
    };
  }

  /**
   * Where an element, relationship or view is stored. Deletes pass `scan` to search the folders instead of the index:
   * they clear the index, so building it again only to find one element would make a series of deletes twice as slow.
   */
  private findElementLocationById(
    elementId: string,
    scan = false
  ): {
    folderKey: FolderKey;
    folder: Model[FolderKey];
    element: Element;
    index: number;
  } | null {
    if (scan) {
      for (const folderKey of Object.keys(this.model) as FolderKey[]) {
        const folder = this.model[folderKey];
        const index = folder.elements?.findIndex(el => el.id === elementId) ?? -1;
        if (index >= 0) return { folderKey, folder, element: folder.elements![index], index };
      }
      return null;
    }
    const entry = this.index.element(elementId);
    if (!entry) return null;
    const folder = this.model[entry.folderKey];
    return { folderKey: entry.folderKey, folder, element: entry.element, index: folder.elements!.indexOf(entry.element) };
  }

  /**
   * @param removeUndefined Whether a key set to undefined removes that field instead of being skipped.
   */
  private mergeElementPatch(element: Element, patch: Partial<Omit<Element, 'id'>>, removeUndefined = false): Element {
    const updatedElement: Element = { ...element };

    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) {
        if (!removeUndefined || key === 'id' || key === 'type') continue;
        if (key === 'name') updatedElement.name = '';
        else delete (updatedElement as any)[key];
        continue;
      }

      if (key === 'properties' && value instanceof Map) {
        updatedElement.properties = new Map(element.properties || []);
        for (const [propKey, propValue] of value.entries()) {
          updatedElement.properties.set(propKey, propValue);
        }
      } else {
        (updatedElement as any)[key] = deepCopy(value);
      }
    }

    return updatedElement;
  }

  /**
   * Removes relationships attached to the elements, and transitively any
   * relationships attached to those relationships.
   */
  private removeRelationshipsForElements(elementIds: ReadonlySet<string>): Element[] {
    const relationships = this.model.relations.elements || [];
    const byEndpoint = relationshipsByEndpoint(relationships as Relationship[]);

    const removed = new Set<Element>();
    const pending = [...elementIds];
    for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
      for (const relationship of byEndpoint.get(id) ?? []) {
        if (removed.has(relationship)) continue;
        removed.add(relationship);
        pending.push(relationship.id);
      }
    }

    this.model.relations.elements = relationships.filter(relationship => !removed.has(relationship));
    return relationships.filter(relationship => removed.has(relationship));
  }

  private removeDiagramModelReferences(viewId: string): void {
    this.removeViewChildren(child => child.type === 'DiagramModelReference' && child.model === viewId);
  }

  /**
   * Removes matching children at any depth in every view, with their contents,
   * connections from or to anything removed, and every targetConnections
   * reference to a removed connection.
   */
  private removeViewChildren(shouldRemove: (child: Child) => boolean): void {
    for (const viewElement of this.model.diagrams.elements || []) {
      if (!viewElement.child) continue;

      const children = toArray(viewElement.child);
      const removedIds = new Set<string>();
      const keptChildren = this.removeMatchingChildren(children, shouldRemove, removedIds);
      if (removedIds.size === 0) continue;

      viewElement.child = keptChildren;
      // Connections from other objects to a removed child go with it, as do connections attached to those.
      while (this.removeViewConnectionsFromChildren(keptChildren, new Set(), removedIds));
      this.removeTargetConnectionReferences(keptChildren, removedIds);
    }
  }

  /**
   * Removes matching children at any depth, collecting the ids of the removed children, their contents and their connections.
   */
  private removeMatchingChildren(children: Child[], shouldRemove: (child: Child) => boolean, removedIds: Set<string>): Child[] {
    const keptChildren: Child[] = [];

    for (const child of children) {
      if (shouldRemove(child)) {
        this.collectSubtreeIds(child, removedIds);
        continue;
      }

      const nested = child.child ?? [];
      if (nested.length > 0) {
        const keptNested = this.removeMatchingChildren(nested, shouldRemove, removedIds);
        if (keptNested.length === 0) {
          delete child.child;
        } else if (keptNested.length !== nested.length) {
          child.child = keptNested;
        }
      }

      keptChildren.push(child);
    }

    return keptChildren;
  }

  private collectSubtreeIds(child: Child, ids: Set<string>): void {
    ids.add(child.id);
    for (const connection of this.getAllSourceConnections(child)) {
      ids.add(connection.id);
    }
    for (const nested of child.child ?? []) {
      this.collectSubtreeIds(nested, ids);
    }
  }

  /**
   * Removes view connections for the relationships, connections nested in them,
   * connections attached to a removed connection, and every targetConnections
   * reference to a removed connection.
   */
  private removeViewConnectionsForRelationships(relationshipIds: Set<string>): void {
    for (const viewElement of this.model.diagrams.elements || []) {
      if (!viewElement.child) continue;

      const children = toArray(viewElement.child);
      const removedConnectionIds = new Set<string>();
      // A connection can be attached to a removed connection that was visited earlier or later.
      while (this.removeViewConnectionsFromChildren(children, relationshipIds, removedConnectionIds));
      if (removedConnectionIds.size > 0) {
        this.removeTargetConnectionReferences(children, removedConnectionIds);
      }
    }
  }

  /**
   * Returns true when a connection was removed.
   */
  private removeViewConnectionsFromChildren(children: Child[], relationshipIds: Set<string>, removedConnectionIds: Set<string>): boolean {
    let removedAny = false;

    for (const child of children) {
      if (this.removeOwnedViewConnections(child, relationshipIds, removedConnectionIds)) removedAny = true;
      if (this.removeViewConnectionsFromChildren(child.child ?? [], relationshipIds, removedConnectionIds)) {
        removedAny = true;
      }
    }

    return removedAny;
  }

  /**
   * Filters the connections starting on a child or connection, keeping the single-object or array shape of
   * `sourceConnection`.
   */
  private removeOwnedViewConnections(
    owner: { sourceConnection?: SourceConnection | SourceConnection[] },
    relationshipIds: Set<string>,
    removedConnectionIds: Set<string>
  ): boolean {
    const sourceConnection = owner.sourceConnection;
    if (!sourceConnection) return false;

    const connections = toArray(sourceConnection);
    let removedAny = false;
    for (const connection of connections) {
      if (this.removeOwnedViewConnections(connection, relationshipIds, removedConnectionIds)) removedAny = true;
    }

    const kept = this.removeViewConnections(connections, relationshipIds, removedConnectionIds);
    if (kept.length === connections.length) return removedAny;

    if (kept.length === 0) {
      delete owner.sourceConnection;
    } else {
      owner.sourceConnection = Array.isArray(sourceConnection) ? kept : kept[0];
    }
    return true;
  }

  private removeViewConnections(
    connections: SourceConnection[],
    relationshipIds: Set<string>,
    removedConnectionIds: Set<string>
  ): SourceConnection[] {
    return connections.filter(connection => {
      const shouldRemove =
        (connection.archimateRelationship !== undefined && relationshipIds.has(connection.archimateRelationship)) ||
        removedConnectionIds.has(connection.source) ||
        removedConnectionIds.has(connection.target);
      if (shouldRemove) {
        // Connections nested in a removed connection go with it.
        for (const removed of this.flattenConnections([connection])) {
          removedConnectionIds.add(removed.id);
        }
      }
      return !shouldRemove;
    });
  }

  private removeTargetConnectionReferences(children: Child[], connectionIds: Set<string>): void {
    for (const child of children) {
      this.removeTargetConnectionReference(child, connectionIds);
      for (const connection of this.getAllSourceConnections(child)) {
        this.removeTargetConnectionReference(connection, connectionIds);
      }
      this.removeTargetConnectionReferences(child.child ?? [], connectionIds);
    }
  }

  private removeTargetConnectionReference(owner: { targetConnections?: string }, connectionIds: Set<string>): void {
    const ids = splitIds(owner.targetConnections);
    const kept = ids.filter(id => !connectionIds.has(id));
    if (kept.length === ids.length) return;
    if (kept.length === 0) {
      delete owner.targetConnections;
    } else {
      owner.targetConnections = kept.join(' ');
    }
  }

  private recordFolderIds(folders: Folder[], path: string, seenIds: Map<string, string>, issues: PendingIssue[]): void {
    for (const [index, folder] of folders.entries()) {
      const folderPath = `${path}.folders[${index}]`;
      this.recordId(folder.id, folderPath, seenIds, issues);
      this.recordFolderIds(folder.folders || [], folderPath, seenIds, issues);
    }
  }

  /**
   * The top-level folder for a folder key; throws on an unknown key.
   */
  private topLevelFolder(folderKey: FolderKey): ModelFolder {
    assertCode('folder', folderKey, TopLevelFolder);
    return this.model[folderKey];
  }

  private assertRelationshipType(type: string): asserts type is ArchimateRelationshipType {
    if (elementTypeToFolderKey.get(type as ArchimateModelType) !== 'relations') {
      throw new Error(`Unknown relationship type "${type}".`);
    }
  }

  /**
   * Returns the element or relationship a new relationship starts or ends on; throws when there is none.
   */
  private relationshipEndpoint(elementId: string, endpoint: 'source' | 'target'): Element {
    const element = this.index.element(elementId)?.element;
    if (!element || elementTypeToFolderKey.get(element.type) === 'diagrams') {
      throw new Error(`Relationship ${endpoint} element "${elementId}" not found in model.`);
    }
    return element;
  }

  private validateElementFields(element: Element, path: string, issues: PendingIssue[]): void {
    if (!element.id) {
      issues.push({
        code: 'missing-id',
        message: 'Element is missing an id.',
        path,
      });
    }

    // Archi writes relationships and junctions without a name by default.
    if (!element.name && element.type !== 'Junction' && elementTypeToFolderKey.get(element.type) !== 'relations') {
      issues.push({
        code: 'missing-name',
        message: `Element "${element.id || path}" is missing a name.`,
        path,
        id: element.id,
      });
    }

    if (!element.type) {
      issues.push({
        code: 'missing-type',
        message: `Element "${element.id || path}" has no type.`,
        path,
        id: element.id,
      });
    } else if (!isArchimateModelType(element.type)) {
      issues.push({
        code: 'unknown-type',
        message: `Element "${element.id || path}" has unknown type "${element.type}".`,
        path,
        id: element.id,
      });
    }
  }

  private validateElementProfiles(element: Element, path: string, profileIds: Set<string>, issues: PendingIssue[]): void {
    for (const profileId of (element.profiles || '').split(' ').filter(Boolean)) {
      if (!profileIds.has(profileId)) {
        issues.push({
          code: 'element-missing-profile',
          message: `Element "${element.id || path}" references missing profile "${profileId}".`,
          path,
          id: element.id,
        });
      }
    }
  }

  private recordId(id: string | undefined, path: string, seenIds: Map<string, string>, issues: PendingIssue[]): void {
    if (!id) return;

    const firstPath = seenIds.get(id);
    if (firstPath) {
      issues.push({
        code: 'duplicate-id',
        message: `Duplicate id "${id}" found at ${path}; first seen at ${firstPath}.`,
        path,
        id,
      });
      return;
    }

    seenIds.set(id, path);
  }

  /**
   * Relationship endpoints may be model elements or other relationships (ArchiMate 3).
   */
  private validateRelationships(endpoints: Map<string, Element>, issues: PendingIssue[]): void {
    const relationships = (this.model.relations.elements || []) as Relationship[];
    const byEndpoint = relationshipsByEndpoint(relationships);

    for (const [index, relationship] of relationships.entries()) {
      const path = `folder.relations.elements[${index}]`;
      const source = relationship.source ? endpoints.get(relationship.source) : undefined;
      const target = relationship.target ? endpoints.get(relationship.target) : undefined;

      if (relationship.source && !source) {
        issues.push({
          code: 'relationship-missing-source',
          message: `Relationship "${relationship.id}" references missing source element "${relationship.source}".`,
          path,
          id: relationship.id,
        });
      }

      if (relationship.target && !target) {
        issues.push({
          code: 'relationship-missing-target',
          message: `Relationship "${relationship.id}" references missing target element "${relationship.target}".`,
          path,
          id: relationship.id,
        });
      }

      const typeIssue =
        source && target
          ? this.relationshipTypeIssue(
              relationship,
              source,
              target,
              id => endpoints.get(id),
              id => byEndpoint.get(id) || []
            )
          : null;
      if (typeIssue) {
        issues.push({ ...typeIssue, path, id: relationship.id });
      }
    }
  }

  /**
   * Checks a relationship's type against Archi's rules, following ArchimateModelUtils.isValidRelationship
   * (commit ccdac67) and the relationships matrix (com.archimatetool.model/model/relationships.xml, commit 6d23608):
   * - a relationship may not connect to itself or to one of its own endpoints (hasDirectRelationship);
   * - the type must be allowed by the matrix between the source and target types;
   * - on a Junction, the relationships on either side must also be allowed between the concepts it links,
   *   and every relationship on it must have the same type, except aggregation or composition from a
   *   Grouping or Location.
   * The relationship itself is left out of the Junction's relationships, so this works for new and stored ones.
   */
  private relationshipTypeIssue(
    relationship: { id?: string; type: string },
    source: Element,
    target: Element,
    lookup: (id: string) => Element | undefined,
    relationshipsOf: (id: string) => Relationship[]
  ): Pick<PendingIssue, 'code' | 'message'> | null {
    const label = relationship.id ? `Relationship "${relationship.id}"` : 'Relationship';
    const isRelationship = (element: Element) => elementTypeToFolderKey.get(element.type) === 'relations';
    const type = relationship.type;

    const connects = (endpoint: Element, other: Element) =>
      endpoint.id === relationship.id || (endpoint as Relationship).source === other.id || (endpoint as Relationship).target === other.id;
    if ((isRelationship(target) && connects(target, source)) || (isRelationship(source) && connects(source, target))) {
      return {
        code: 'relationship-endpoint-not-allowed',
        message: `${label} cannot connect "${source.id}" to "${target.id}": a relationship cannot connect to itself or to one of its own endpoints.`,
      };
    }

    // Unknown relationship and element types are not checked here; they are reported as unknown-type.
    if (!matrixRelationshipTypes.has(type)) return null;
    const isAllowed = (from: Element, to: Element) =>
      allowedRelationshipTypes(from.type, to.type)?.includes(type as ArchimateRelationshipType) ?? true;

    if (!isAllowed(source, target)) {
      return {
        code: isRelationship(source) || isRelationship(target) ? 'relationship-endpoint-not-allowed' : 'relationship-type-not-allowed',
        message: `${label} of type ${relationship.type} is not allowed from ${source.type} "${source.id}" to ${target.type} "${target.id}".`,
      };
    }

    const isGroupingOrLocationStructural = (from: Element | undefined, relationshipType: string) =>
      (from?.type === 'Grouping' || from?.type === 'Location') &&
      ['AggregationRelationship', 'CompositionRelationship'].includes(relationshipType);

    const junctionIssue = (junction: Element, side: 'source' | 'target'): Pick<PendingIssue, 'code' | 'message'> | null => {
      const others = relationshipsOf(junction.id).filter(other => other.id !== relationship.id);

      // Relationships on the other side of the Junction must be valid between the concepts it links.
      for (const other of others) {
        const linked =
          side === 'source'
            ? other.target === junction.id
              ? lookup(other.source)
              : undefined
            : other.source === junction.id
              ? lookup(other.target)
              : undefined;
        if (!linked) continue;
        const [from, to] = side === 'source' ? [linked, target] : [source, linked];
        if (!isAllowed(from, to)) {
          return {
            code: 'relationship-type-not-allowed',
            message: `${label} of type ${relationship.type} is not allowed from ${from.type} "${from.id}" to ${to.type} "${to.id}" through Junction "${junction.id}".`,
          };
        }
      }

      const mismatch = others.find(other => !isGroupingOrLocationStructural(lookup(other.source), other.type) && other.type !== type);
      if (mismatch) {
        return {
          code: 'junction-relationship-type-mismatch',
          message: `${label} of type ${relationship.type} does not match relationship "${mismatch.id}" of type ${mismatch.type} on Junction "${junction.id}": all relationships on a Junction must have the same type.`,
        };
      }
      return null;
    };

    if (source.type === 'Junction') {
      const issue = junctionIssue(source, 'source');
      if (issue) return issue;
    }
    // Grouping and Location may aggregate or compose a Junction whatever its other relationships are.
    if (target.type === 'Junction' && !isGroupingOrLocationStructural(source, relationship.type)) {
      return junctionIssue(target, 'target');
    }
    return null;
  }

  private validateViews(
    modelElementIds: Set<string>,
    relationshipIds: Set<string>,
    seenIds: Map<string, string>,
    issues: PendingIssue[]
  ): void {
    const viewIds = new Set((this.model.diagrams.elements || []).map(view => view.id));

    for (const [viewIndex, viewElement] of (this.model.diagrams.elements || []).entries()) {
      const viewPath = `folder.diagrams.elements[${viewIndex}]`;
      if (!viewElement.child) continue;

      const children = toArray(viewElement.child);
      const childIds = new Set<string>();
      const connectionIds = new Set<string>();

      this.collectViewIds(children, viewPath, childIds, connectionIds, seenIds, issues);
      // Connections can start or end on other connections, e.g. a relationship drawn onto a relationship.
      const endpointIds = new Set([...childIds, ...connectionIds]);
      this.validateViewChildren(children, viewPath, { modelElementIds, relationshipIds, viewIds, endpointIds, connectionIds }, issues);
    }
  }

  private collectViewIds(
    children: Child[],
    path: string,
    childIds: Set<string>,
    connectionIds: Set<string>,
    seenIds: Map<string, string>,
    issues: PendingIssue[]
  ): void {
    for (const [index, child] of children.entries()) {
      const childPath = `${path}.children[${index}]`;
      if (child.id) {
        childIds.add(child.id);
        this.recordId(child.id, childPath, seenIds, issues);
      }

      for (const connection of this.getAllSourceConnections(child)) {
        if (connection.id) {
          connectionIds.add(connection.id);
          this.recordId(connection.id, `${childPath}.sourceConnections`, seenIds, issues);
        }
      }

      this.collectViewIds(child.child ?? [], childPath, childIds, connectionIds, seenIds, issues);
    }
  }

  private validateViewChildren(children: Child[], path: string, ids: ViewValidationIds, issues: PendingIssue[]): void {
    const { modelElementIds, relationshipIds, viewIds, endpointIds, connectionIds } = ids;
    for (const [index, child] of children.entries()) {
      const childPath = `${path}.children[${index}]`;

      if (child.type === 'DiagramObject' && child.archimateElement && !modelElementIds.has(child.archimateElement)) {
        issues.push({
          code: 'diagram-object-missing-element',
          message: `Diagram object "${child.id}" references missing element "${child.archimateElement}".`,
          path: childPath,
          id: child.id,
        });
      }

      if (child.type === 'DiagramModelReference' && child.model && !viewIds.has(child.model)) {
        issues.push({
          code: 'diagram-reference-missing-view',
          message: `Diagram model reference "${child.id}" references missing view "${child.model}".`,
          path: childPath,
          id: child.id,
        });
      }

      for (const connection of this.getAllSourceConnections(child)) {
        this.validateViewConnection(connection, childPath, relationshipIds, endpointIds, issues);
        this.validateTargetConnections(connection, 'View connection', childPath, connectionIds, issues);
      }

      this.validateTargetConnections(child, 'Diagram object', childPath, connectionIds, issues);

      this.validateViewChildren(child.child ?? [], childPath, ids, issues);
    }
  }

  private validateTargetConnections(
    owner: { id: string; targetConnections?: string },
    label: string,
    path: string,
    connectionIds: Set<string>,
    issues: PendingIssue[]
  ): void {
    for (const targetConnectionId of splitIds(owner.targetConnections)) {
      if (!connectionIds.has(targetConnectionId)) {
        issues.push({
          code: 'view-target-connection-missing-source',
          message: `${label} "${owner.id}" references missing target connection "${targetConnectionId}".`,
          path,
          id: owner.id,
        });
      }
    }
  }

  private validateViewConnection(
    connection: SourceConnection,
    path: string,
    relationshipIds: Set<string>,
    endpointIds: Set<string>,
    issues: PendingIssue[]
  ): void {
    if (connection.archimateRelationship && !relationshipIds.has(connection.archimateRelationship)) {
      issues.push({
        code: 'view-connection-missing-relationship',
        message: `View connection "${connection.id}" references missing relationship "${connection.archimateRelationship}".`,
        path,
        id: connection.id,
      });
    }

    if (connection.source && !endpointIds.has(connection.source)) {
      issues.push({
        code: 'view-connection-missing-source',
        message: `View connection "${connection.id}" references missing source object "${connection.source}".`,
        path,
        id: connection.id,
      });
    }

    if (connection.target && !endpointIds.has(connection.target)) {
      issues.push({
        code: 'view-connection-missing-target',
        message: `View connection "${connection.id}" references missing target object "${connection.target}".`,
        path,
        id: connection.id,
      });
    }
  }

  /**
   * The child's connections, including connections nested in them (connection-to-connection).
   */
  private getAllSourceConnections(child: Child): SourceConnection[] {
    return this.flattenConnections(toArray(child.sourceConnection));
  }

  /**
   * The connections and every connection nested in them.
   */
  private flattenConnections(connections: SourceConnection[]): SourceConnection[] {
    return connections.flatMap(connection => {
      const nested = connection.sourceConnection;
      if (!nested) return [connection];
      return [connection, ...this.flattenConnections(toArray(nested))];
    });
  }
}
