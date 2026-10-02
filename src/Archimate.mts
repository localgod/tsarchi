import type { Model, FolderKey, ModelContent, ModelFolder, ModelFolderDetails } from './interfaces/Model.mjs';
import type { Profile } from './interfaces/Profile.mjs';
import type { Schema as ArchimateSchema } from './interfaces/schema/Schema.mjs';
import type { ModelAttributes } from './interfaces/schema/Model.mjs';
import type { XmlMetadata } from './interfaces/schema/XmlMetadata.mjs';
import type { Element } from './interfaces/Element.mjs';
import type { Folder, FolderDetails } from './interfaces/Folder.mjs';
import type { Relationship, RelationshipInput } from './interfaces/Relationship.mjs';
import type { Child } from './interfaces/Child.mjs';
import type { View, ViewConnection } from './interfaces/View.mjs';
import type { Bounds } from './interfaces/Bounds.mjs';
import { ArchimateValidationError } from './interfaces/ValidationIssue.mjs';
import type { ValidationIssue, ValidationIssueCode } from './interfaces/ValidationIssue.mjs';
import { Parser } from './internal/Parser.mjs'
import { Serializer } from './internal/Serializer.mjs'
import { ViewManager } from './ViewManager.mjs'
import { folderType, elementTypeToFolderKey, isArchimateModelType, canvasModelTypes, archimateNamespace, canvasNamespace, allowedRelationshipTypes, resolveRelationshipType } from './constants/archimate-mappings.mjs';
import { relationshipMatrixKeys } from './constants/relationships-matrix.mjs';
import type { ArchimateModelType, ArchimateRelationshipAliasType, ArchimateRelationshipType } from './constants/archimate-mappings.mjs';

/**
 * Codes for models Archi opens and saves, but that break a naming convention or an ArchiMate rule
 * Archi only enforces when relationships are created. Every other code is an error.
 */
const warningIssueCodes = new Set<ValidationIssueCode>([
  'missing-name',
  'relationship-endpoint-not-allowed',
  'relationship-type-not-allowed',
  'junction-relationship-type-mismatch',
]);

type PendingIssue = Omit<ValidationIssue, 'severity'>;

type StoredViewChild = Omit<Child, 'child' | 'targetConnections'> & {
  archimateElement?: string;
  children?: StoredViewChild[];
  child?: StoredViewChild[];
  sourceConnections?: ViewConnection[];
  targetConnections?: string | string[];
};

type StoredViewConnection = ViewConnection & {
  targetConnections?: string;
  sourceConnection?: StoredViewConnection | StoredViewConnection[];
};

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

  private name: string

  /** Model-level content besides the folders: purpose, properties, metadata, profiles and unrecognised content. */
  private content: ModelContent

  private xmlMetadata: XmlMetadata

  private modelMetadata: ModelAttributes

  private model: Model

  private viewManager: ViewManager

  public constructor() {
    this.name = ''
    this.content = {}
    this.xmlMetadata = this.defaultXmlMetadata()
    this.modelMetadata = this.defaultModelMetadata()
    this.model = this.init()
    this.viewManager = new ViewManager(this.model, () => this.generateUniqueId())
  }

  private defaultXmlMetadata(): XmlMetadata {
    return { '@_version': '1.0', '@_encoding': 'UTF-8' };
  }

  private defaultModelMetadata(): ModelAttributes {
    return {
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@_xmlns:archimate': archimateNamespace,
      '@_name': this.name,
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

  public generateRandomId(): string {
    const characters = 'abcdef0123456789';
    const idLength = 32;
    let randomId = 'id-';

    for (let i = 0; i < idLength; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      randomId += characters.charAt(randomIndex);
    }

    return randomId;
  }

  /**
   * Returns true when an ID is already used by the model, folders, views,
   * diagram children, view connections or profiles.
   */
  public hasId(id: string): boolean {
    if (!id) return false;
    if (this.content.profiles?.some(profile => profile.id === id)) return true;

    for (const folderKey of Object.keys(this.model) as FolderKey[]) {
      const folder = this.model[folderKey];
      if (folder.id === id) return true;
      if (this.foldersHaveId(folder.folders || [], id)) return true;

      for (const element of folder.elements || []) {
        if (element.id === id) return true;
        if (element.child && this.childrenHaveId(
          (Array.isArray(element.child) ? element.child : [element.child]) as StoredViewChild[],
          id
        )) {
          return true;
        }
      }
    }

    return false;
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
   * Updates are matched on `id` when one is given. Without an `id`, a named
   * element matches an existing element with the same `name` + `type`;
   * unnamed elements (such as junctions) are always added.
   * Throws when the given `id` is already used by something other than an
   * element in the target folder.
   * Only provided properties are overwritten; others remain unchanged.
   * @param element Partial or full element data to insert or update.
   */
  public upsertElement(element: Partial<Element> & Pick<Element, 'name' | 'type'>): void {
    const folderKey = elementTypeToFolderKey.get(element.type);

    if (!folderKey) {
      throw new Error(`Unknown element type "${element.type}".`);
    }

    const folder = this.model[folderKey];

    if (!folder.elements) {
      folder.elements = [];
    }

    const existingIndex = element.id
      ? folder.elements.findIndex(e => e.id === element.id)
      : element.name
        ? folder.elements.findIndex(e => e.name === element.name && e.type === element.type)
        : -1;

    if (existingIndex < 0 && element.id && this.hasId(element.id)) {
      throw new Error(`ID "${element.id}" is already in use.`);
    }

    if (existingIndex >= 0) {
      const existingElement = folder.elements[existingIndex];

      for (const [key, value] of Object.entries(element)) {
        if (value === undefined) continue;

        if (key === 'id') {
          // Always keep the original id
          continue;
        }

        if (key === 'properties' && value instanceof Map) {
          if (!(existingElement.properties instanceof Map)) {
            existingElement.properties = new Map();
          }
          for (const [propKey, propValue] of value.entries()) {
            existingElement.properties.set(propKey, propValue);
          }
        } else {
          (existingElement as any)[key] = value;
        }
      }

      console.log(`Updated element "${existingElement.name}" (Type: ${existingElement.type}) in folder "${folderType.get(folderKey)}".`);
    } else {
      if (!('id' in element) || !element.id) {
        element.id = this.generateUniqueId();
      }
      folder.elements.push(element as Element);
      console.log(`Added element "${element.name}" (ID: ${element.id}, Type: ${element.type}) to folder "${folderType.get(folderKey)}".`);
    }
  }

  /**
   * Finds an element with the given name within a specific folder.
   * @param folderKey The key of the folder to search within.
   * @param elementName The name of the element to find.
   * @returns The Element object if found, otherwise null.
   */
  public findElementInFolderByName(folderKey: FolderKey, elementName: string): Element | null {
    const folder = this.model[folderKey];
    return folder?.elements?.find(el => el.name === elementName) || null;
  }

  /**
   * Retrieves an element or relationship by ID from any folder.
   */
  public getElement(elementId: string): Element | null {
    return this.findElementLocationById(elementId)?.element || null;
  }

  /**
   * Finds all elements with a matching name across all folders.
   */
  public findElementsByName(elementName: string): Element[] {
    const results: Element[] = [];

    for (const folderKey of Object.keys(this.model) as FolderKey[]) {
      const folder = this.model[folderKey];
      results.push(...(folder.elements || []).filter(el => el.name === elementName));
    }

    return results;
  }

  /**
   * Updates an element by ID.
   *
   * If the type changes, the element is moved to the appropriate folder.
   * Relationship source/target and IDs are preserved unless explicitly patched.
   */
  public updateElement(elementId: string, patch: Partial<Omit<Element, 'id'>>): Element | null {
    const location = this.findElementLocationById(elementId);
    if (!location) return null;

    const nextType = patch.type ?? location.element.type;
    const nextFolderKey = elementTypeToFolderKey.get(nextType);
    if (!nextFolderKey) {
      throw new Error(`Unknown element type "${nextType}".`);
    }

    const updatedElement = this.mergeElementPatch(location.element, patch);

    if (nextFolderKey === location.folderKey) {
      location.folder.elements![location.index] = updatedElement;
    } else {
      location.folder.elements!.splice(location.index, 1);
      this.removeFromNestedFolders(location.folder.folders || [], elementId);
      const nextFolder = this.model[nextFolderKey];
      if (!nextFolder.elements) nextFolder.elements = [];
      nextFolder.elements.push(updatedElement);
    }

    return updatedElement;
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
    const location = this.findElementLocationById(elementId);
    if (!location) return false;

    const deletedElement = location.element;
    location.folder.elements!.splice(location.index, 1);
    this.removeFromNestedFolders(location.folder.folders || [], elementId);

    const removedRelationshipIds = new Set<string>();
    if (location.folderKey === 'relations') {
      removedRelationshipIds.add(deletedElement.id);
    }
    for (const relationship of this.removeRelationshipsForElement(elementId)) {
      removedRelationshipIds.add(relationship.id);
    }
    if (removedRelationshipIds.size > 0) {
      this.removeViewConnectionsForRelationships(removedRelationshipIds);
    }
    if (location.folderKey !== 'relations') {
      this.removeDiagramObjectsForElement(elementId);
    }

    return true;
  }

  /**
   * Inserts or updates a relationship in the relations folder.
   *
   * Updates are matched by id when provided, otherwise by name + type + source + target.
   */
  public upsertRelationship(input: RelationshipInput): Relationship {
    const type = resolveRelationshipType(input.type);
    this.assertRelationshipType(type);
    const relationship = { ...input, type };
    this.assertRelationshipEndpointExists(relationship.source, 'source');
    this.assertRelationshipEndpointExists(relationship.target, 'target');
    const typeIssue = this.relationshipTypeIssue(
      relationship,
      this.getElement(relationship.source)!,
      this.getElement(relationship.target)!,
      id => this.getElement(id) ?? undefined,
      id => this.findRelationshipsForElement(id)
    );
    if (typeIssue) throw new Error(typeIssue.message);

    const folder = this.model.relations;
    if (!folder.elements) folder.elements = [];

    const existingIndex = relationship.id
      ? folder.elements.findIndex(el => el.id === relationship.id)
      : folder.elements.findIndex(el =>
        el.name === relationship.name &&
        el.type === relationship.type &&
        el.source === relationship.source &&
        el.target === relationship.target
      );

    if (existingIndex >= 0) {
      const updatedRelationship = this.mergeElementPatch(
        folder.elements[existingIndex],
        relationship
      ) as Relationship;
      folder.elements[existingIndex] = updatedRelationship;
      return updatedRelationship;
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
    if (relationship.profiles !== undefined) newRelationship.profiles = relationship.profiles;
    if (relationship.features !== undefined) newRelationship.features = relationship.features;
    folder.elements.push(newRelationship);
    return newRelationship;
  }

  /**
   * Retrieves a relationship by ID.
   */
  public getRelationship(relationshipId: string): Relationship | null {
    const relationship = this.model.relations.elements?.find(el => el.id === relationshipId);
    return relationship ? relationship as Relationship : null;
  }

  /**
   * Finds relationships connected to an element.
   */
  public findRelationshipsForElement(elementId: string, direction: 'source' | 'target' | 'both' = 'both'): Relationship[] {
    return (this.model.relations.elements || []).filter(relationship => {
      if (direction === 'source') return relationship.source === elementId;
      if (direction === 'target') return relationship.target === elementId;
      return relationship.source === elementId || relationship.target === elementId;
    }) as Relationship[];
  }

  /**
   * Finds relationships between two elements.
   */
  public findRelationshipsBetween(sourceElementId: string, targetElementId: string, options?: {
    bidirectional?: boolean;
    type?: ArchimateRelationshipType | ArchimateRelationshipAliasType;
  }): Relationship[] {
    return (this.model.relations.elements || []).filter(relationship => {
      const directMatch = relationship.source === sourceElementId && relationship.target === targetElementId;
      const reverseMatch = options?.bidirectional === true &&
        relationship.source === targetElementId &&
        relationship.target === sourceElementId;
      const typeMatch = options?.type ? relationship.type === resolveRelationshipType(options.type) : true;

      return typeMatch && (directMatch || reverseMatch);
    }) as Relationship[];
  }

  /**
   * Deletes a relationship and removes matching view connections.
   */
  public deleteRelationship(relationshipId: string): boolean {
    const relationship = this.getRelationship(relationshipId);
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

  public parse(input: ArchimateSchema): void {
    const parser = new Parser(this.model);
    this.model = parser.parse(input);
    this.name = input['archimate:model']?.['@_name'] || 'Unnamed Model';
    this.content = parser.parseModelContent(input);
    const defaultModelMetadata = this.defaultModelMetadata();
    this.xmlMetadata = input['?xml'] || this.defaultXmlMetadata();
    const namespaces = Object.fromEntries(
      Object.entries(input['archimate:model'] ?? {}).filter(([key, value]) => key.startsWith('@_xmlns:') && value)
    );
    this.modelMetadata = {
      ...defaultModelMetadata,
      ...namespaces,
      '@_name': this.name,
      '@_id': input['archimate:model']?.['@_id'] || defaultModelMetadata['@_id'],
      '@_version': input['archimate:model']?.['@_version'] || defaultModelMetadata['@_version'],
    };
  }

  public serialize(): ArchimateSchema {
    const serializer = new Serializer(this.model)
    return serializer.serialize(this.withRequiredNamespaces(this.modelMetadata), this.xmlMetadata, this.content)
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
   * Returns the specializations defined on the model, in file order.
   */
  public getProfiles(): Profile[] {
    return [...(this.content.profiles ?? [])];
  }

  /**
   * Returns the profile with the given id, or null.
   */
  public getProfile(profileId: string): Profile | null {
    return this.content.profiles?.find(profile => profile.id === profileId) ?? null;
  }

  /**
   * Replaces the specializations defined on the model. Elements and relationships refer to them by id through
   * `Element.profiles`; validateModel() reports references to profiles that do not exist.
   */
  public setProfiles(profiles: Profile[] | undefined): void {
    this.content.profiles = profiles && profiles.length > 0 ? [...profiles] : undefined;
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
      (Array.isArray(children) ? children : children ? [children] : []).some(child =>
        canvasTypes.includes(child.type) || hasCanvasType(child.child));
    return (this.model.diagrams.elements || []).some(view => canvasTypes.includes(view.type) || hasCanvasType(view.child));
  }

  // View Management API

  /**
   * Creates a new view with the specified name and optional properties
   */
  public createView(name: string, options?: {
    viewpoint?: string;
    background?: number;
    documentation?: string;
  }): View {
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
  public addDiagramObject(viewId: string, elementId: string, bounds: Bounds, options?: {
    fillColor?: string;
    lineColor?: string;
    fontColor?: string;
    textAlignment?: number;
  }) {
    return this.viewManager.addDiagramObject(viewId, elementId, bounds, options);
  }

  /**
   * Creates a group in a view to organize diagram objects
   */
  public addGroup(viewId: string, name: string, bounds: Bounds, options?: {
    fillColor?: string;
    lineColor?: string;
    textAlignment?: number;
    documentation?: string;
  }) {
    return this.viewManager.addGroup(viewId, name, bounds, options);
  }

  /**
   * Adds a diagram object to a group within a view
   */
  public addDiagramObjectToGroup(viewId: string, groupId: string, elementId: string, bounds: Bounds, options?: {
    fillColor?: string;
    lineColor?: string;
    fontColor?: string;
    textAlignment?: number;
  }) {
    return this.viewManager.addDiagramObjectToGroup(viewId, groupId, elementId, bounds, options);
  }

  /**
   * Creates a connection between two diagram objects in a view
   */
  public addConnection(viewId: string, sourceObjectId: string, targetObjectId: string, relationshipId?: string, options?: {
    lineColor?: string;
    lineWidth?: number;
    fontColor?: string;
    textPosition?: number;
  }) {
    return this.viewManager.addConnection(viewId, sourceObjectId, targetObjectId, relationshipId, options);
  }

  /**
   * Auto-generates a view based on elements and their relationships
   */
  public generateViewFromElements(name: string, elementIds: string[], options?: {
    includeRelationships?: boolean;
    layoutType?: 'hierarchical' | 'circular' | 'grid';
    viewpoint?: string;
  }): View | null {
    return this.viewManager.generateViewFromElements(name, elementIds, options);
  }

  /**
   * Updates visual properties of a diagram object
   */
  public updateDiagramObjectStyle(viewId: string, objectId: string, style: {
    fillColor?: string;
    lineColor?: string;
    fontColor?: string;
    bounds?: Bounds;
    textAlignment?: number;
  }): boolean {
    return this.viewManager.updateDiagramObjectStyle(viewId, objectId, style);
  }

  /**
   * Removes a view from the model, together with the diagram model references to it in other views
   * and the connections attached to those references, as Archi does.
   */
  public deleteView(viewId: string): boolean {
    if (!this.viewManager.deleteView(viewId)) return false;
    this.removeDiagramModelReferences(viewId);
    return true;
  }

  /**
   * Helper method to find elements by type for view generation
   */
  public findElementsByType(elementType: ArchimateModelType): Element[] {
    const results: Element[] = [];
    
    for (const folderKey of Object.keys(this.model) as Array<keyof Model>) {
      const folder = this.model[folderKey];
      if (folder.elements) {
        const matchingElements = folder.elements.filter(el => el.type === elementType);
        results.push(...matchingElements);
      }
    }
    
    return results;
  }

  /**
   * Helper method to find elements by folder for view generation
   */
  public findElementsByFolder(folderKey: FolderKey): Element[] {
    const folder = this.model[folderKey];
    return folder.elements || [];
  }

  /**
   * Returns the nested folders of a top-level folder, in document order.
   *
   * Elements in nested folders are also included in `findElementsByFolder`;
   * a nested folder lists the ids of the elements placed directly in it.
   */
  public getFolders(folderKey: FolderKey): Folder[] {
    return this.model[folderKey].folders || [];
  }

  /**
   * Returns the id, name, documentation, properties and features of a top-level folder. Maps are copies;
   * use `updateFolder` to change them.
   */
  public getFolder(folderKey: FolderKey): ModelFolderDetails {
    return Archimate.folderDetails(this.model[folderKey]);
  }

  /**
   * Updates the name, documentation, properties or features of a top-level folder and returns its new details.
   * A key set to undefined, an empty string or an empty map removes that detail; keys left out are unchanged.
   */
  public updateFolder(folderKey: FolderKey, patch: Partial<Omit<ModelFolderDetails, 'id'>>): ModelFolderDetails {
    return Archimate.applyFolderPatch(this.model[folderKey], patch);
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

    const topLevelIds = new Set((this.model[location.folderKey].elements || []).map(element => element.id));
    const collect = (folder: Folder): string[] =>
      [...(folder.elementIds || []), ...(folder.folders || []).flatMap(collect)];
    for (const id of collect(location.folder as Folder)) {
      if (!topLevelIds.has(id)) continue;
      if (location.folderKey === 'diagrams') this.deleteView(id);
      else this.deleteElement(id);
    }
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

    this.removeFromNestedFolders(element.folder.folders || [], elementId);
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
  private locateFolder(folderId: string): {
    folderKey: FolderKey;
    folder: ModelFolder | Folder;
    parent?: ModelFolder | Folder;
    path: Array<ModelFolder | Folder>;
  } | undefined {
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
   * Creates a view showing all elements of a specific type
   */
  public createViewByElementType(viewName: string, elementType: ArchimateModelType, options?: {
    layoutType?: 'hierarchical' | 'circular' | 'grid';
    includeRelationships?: boolean;
  }): View | null {
    const elements = this.findElementsByType(elementType);
    if (elements.length === 0) return null;

    const elementIds = elements.map(el => el.id);
    return this.generateViewFromElements(viewName, elementIds, options);
  }

  /**
   * Creates a view showing all elements from a specific folder
   */
  public createViewByFolder(viewName: string, folderKey: FolderKey, options?: {
    layoutType?: 'hierarchical' | 'circular' | 'grid';
    includeRelationships?: boolean;
  }): View | null {
    const elements = this.findElementsByFolder(folderKey);
    if (elements.length === 0) return null;

    const elementIds = elements.map(el => el.id);
    return this.generateViewFromElements(viewName, elementIds, options);
  }

  private findElementLocationById(elementId: string): {
    folderKey: FolderKey;
    folder: Model[FolderKey];
    element: Element;
    index: number;
  } | null {
    for (const folderKey of Object.keys(this.model) as FolderKey[]) {
      const folder = this.model[folderKey];
      const index = folder.elements?.findIndex(el => el.id === elementId) ?? -1;

      if (index >= 0 && folder.elements) {
        return {
          folderKey,
          folder,
          element: folder.elements[index],
          index,
        };
      }
    }

    return null;
  }

  private mergeElementPatch(element: Element, patch: Partial<Omit<Element, 'id'>>): Element {
    const updatedElement: Element = { ...element };

    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;

      if (key === 'properties' && value instanceof Map) {
        updatedElement.properties = new Map(element.properties || []);
        for (const [propKey, propValue] of value.entries()) {
          updatedElement.properties.set(propKey, propValue);
        }
      } else {
        (updatedElement as any)[key] = value;
      }
    }

    return updatedElement;
  }

  /**
   * Removes relationships attached to the element, and transitively any
   * relationships attached to those relationships.
   */
  private removeRelationshipsForElement(elementId: string): Element[] {
    const removedIds = new Set([elementId]);
    const removedRelationships: Element[] = [];
    let remaining = this.model.relations.elements || [];

    let removedAny = true;
    while (removedAny) {
      removedAny = false;
      remaining = remaining.filter(relationship => {
        const shouldRemove = [relationship.source, relationship.target].some(id => id !== undefined && removedIds.has(id));
        if (shouldRemove) {
          removedIds.add(relationship.id);
          removedRelationships.push(relationship);
          removedAny = true;
        }
        return !shouldRemove;
      });
    }

    this.model.relations.elements = remaining;
    return removedRelationships;
  }

  private removeDiagramObjectsForElement(elementId: string): void {
    this.removeViewChildren(child => child.type === 'DiagramObject' && child.archimateElement === elementId);
  }

  private removeDiagramModelReferences(viewId: string): void {
    this.removeViewChildren(child => child.type === 'DiagramModelReference' && child.model === viewId);
  }

  /**
   * Removes matching children at any depth in every view, with their contents,
   * connections from or to anything removed, and every targetConnections
   * reference to a removed connection.
   */
  private removeViewChildren(shouldRemove: (child: StoredViewChild) => boolean): void {
    for (const viewElement of this.model.diagrams.elements || []) {
      if (!viewElement.child) continue;

      const children = (Array.isArray(viewElement.child) ? viewElement.child : [viewElement.child]) as StoredViewChild[];
      const removedIds = new Set<string>();
      const keptChildren = this.removeMatchingChildren(children, shouldRemove, removedIds);
      if (removedIds.size === 0) continue;

      viewElement.child = keptChildren as Child[];
      // Connections from other objects to a removed child go with it, as do connections attached to those.
      while (this.removeViewConnectionsFromChildren(keptChildren, new Set(), removedIds));
      this.removeTargetConnectionReferences(keptChildren, removedIds);
    }
  }

  /**
   * Removes matching children at any depth, collecting the ids of the removed children, their contents and their connections.
   */
  private removeMatchingChildren(
    children: StoredViewChild[],
    shouldRemove: (child: StoredViewChild) => boolean,
    removedIds: Set<string>,
  ): StoredViewChild[] {
    const keptChildren: StoredViewChild[] = [];

    for (const child of children) {
      if (shouldRemove(child)) {
        this.collectSubtreeIds(child, removedIds);
        continue;
      }

      const nested = this.getNestedChildren(child);
      if (nested.length > 0) {
        const keptNested = this.removeMatchingChildren(nested, shouldRemove, removedIds);
        if (keptNested.length === 0 && Array.isArray(child.child)) {
          delete child.child;
        } else if (keptNested.length !== nested.length) {
          this.updateNestedChildren(child, keptNested);
        }
      }

      keptChildren.push(child);
    }

    return keptChildren;
  }

  private collectSubtreeIds(child: StoredViewChild, ids: Set<string>): void {
    ids.add(child.id);
    for (const connection of this.getAllSourceConnections(child)) {
      ids.add(connection.id);
    }
    for (const nested of this.getNestedChildren(child)) {
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

      const children = (Array.isArray(viewElement.child) ? viewElement.child : [viewElement.child]) as StoredViewChild[];
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
  private removeViewConnectionsFromChildren(
    children: StoredViewChild[],
    relationshipIds: Set<string>,
    removedConnectionIds: Set<string>,
  ): boolean {
    let removedAny = false;

    for (const child of children) {
      if (child.sourceConnections) {
        const kept = this.removeViewConnections(child.sourceConnections, relationshipIds, removedConnectionIds);
        if (kept.length !== child.sourceConnections.length) {
          child.sourceConnections = kept;
          removedAny = true;
        }
      }
      const loadedOwner = child as { sourceConnection?: StoredViewConnection | StoredViewConnection[] };
      if (this.removeLoadedViewConnections(loadedOwner, relationshipIds, removedConnectionIds)) removedAny = true;
      if (this.removeViewConnectionsFromChildren(this.getNestedChildren(child), relationshipIds, removedConnectionIds)) {
        removedAny = true;
      }
    }

    return removedAny;
  }

  /**
   * Filters the `sourceConnection` loaded from a file, keeping its single-object or array shape.
   */
  private removeLoadedViewConnections(
    owner: { sourceConnection?: StoredViewConnection | StoredViewConnection[] },
    relationshipIds: Set<string>,
    removedConnectionIds: Set<string>,
  ): boolean {
    const sourceConnection = owner.sourceConnection;
    if (!sourceConnection) return false;

    const connections = Array.isArray(sourceConnection) ? sourceConnection : [sourceConnection];
    let removedAny = false;
    for (const connection of connections) {
      if (this.removeLoadedViewConnections(connection, relationshipIds, removedConnectionIds)) removedAny = true;
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

  private removeViewConnections<T extends ViewConnection>(
    connections: T[],
    relationshipIds: Set<string>,
    removedConnectionIds: Set<string>,
  ): T[] {
    return connections.filter(connection => {
      const shouldRemove = (connection.archimateRelationship !== undefined && relationshipIds.has(connection.archimateRelationship))
        || removedConnectionIds.has(connection.source)
        || removedConnectionIds.has(connection.target);
      if (shouldRemove) {
        // Connections nested in a removed connection go with it.
        for (const removed of this.flattenConnections([connection as StoredViewConnection])) {
          removedConnectionIds.add(removed.id);
        }
      }
      return !shouldRemove;
    });
  }

  private removeTargetConnectionReferences(children: StoredViewChild[], connectionIds: Set<string>): void {
    for (const child of children) {
      this.removeTargetConnectionReference(child, connectionIds);
      for (const connection of this.getAllSourceConnections(child)) {
        this.removeTargetConnectionReference(connection, connectionIds);
      }
      this.removeTargetConnectionReferences(this.getNestedChildren(child), connectionIds);
    }
  }

  private removeTargetConnectionReference(
    owner: { targetConnections?: string | string[] },
    connectionIds: Set<string>,
  ): void {
    if (Array.isArray(owner.targetConnections)) {
      owner.targetConnections = owner.targetConnections.filter(id => !connectionIds.has(id));
      return;
    }

    const ids = this.getTargetConnectionIds(owner);
    const kept = ids.filter(id => !connectionIds.has(id));
    if (kept.length === ids.length) return;
    if (kept.length === 0) {
      delete owner.targetConnections;
    } else {
      owner.targetConnections = kept.join(' ');
    }
  }

  private getNestedChildren(child: StoredViewChild): StoredViewChild[] {
    if (Array.isArray(child.children)) return child.children;
    if (Array.isArray(child.child)) return child.child;
    return [];
  }

  private updateNestedChildren(child: StoredViewChild, children: StoredViewChild[]): void {
    if (Array.isArray(child.children)) {
      child.children = children;
    } else {
      child.child = children;
    }
  }

  private childrenHaveId(children: StoredViewChild[], id: string): boolean {
    for (const child of children) {
      if (child.id === id) return true;

      for (const connection of this.getSourceConnections(child)) {
        if (connection.id === id) return true;
      }

      if (this.childrenHaveId(this.getNestedChildren(child), id)) {
        return true;
      }
    }

    return false;
  }

  private foldersHaveId(folders: Folder[], id: string): boolean {
    return folders.some(folder => folder.id === id || this.foldersHaveId(folder.folders || [], id));
  }

  private removeFromNestedFolders(folders: Folder[], elementId: string): void {
    for (const folder of folders) {
      if (folder.elementIds) {
        folder.elementIds = folder.elementIds.filter(id => id !== elementId);
      }
      this.removeFromNestedFolders(folder.folders || [], elementId);
    }
  }

  private recordFolderIds(
    folders: Folder[],
    path: string,
    seenIds: Map<string, string>,
    issues: PendingIssue[]
  ): void {
    for (const [index, folder] of folders.entries()) {
      const folderPath = `${path}.folders[${index}]`;
      this.recordId(folder.id, folderPath, seenIds, issues);
      this.recordFolderIds(folder.folders || [], folderPath, seenIds, issues);
    }
  }

  private assertRelationshipType(type: string): asserts type is ArchimateRelationshipType {
    if (elementTypeToFolderKey.get(type as ArchimateModelType) !== 'relations') {
      throw new Error(`Unknown relationship type "${type}".`);
    }
  }

  private assertRelationshipEndpointExists(elementId: string, endpoint: 'source' | 'target'): void {
    const element = this.getElement(elementId);
    if (!element || elementTypeToFolderKey.get(element.type) === 'diagrams') {
      throw new Error(`Relationship ${endpoint} element "${elementId}" not found in model.`);
    }
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

    if (!isArchimateModelType(element.type)) {
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

  private recordId(
    id: string | undefined,
    path: string,
    seenIds: Map<string, string>,
    issues: PendingIssue[]
  ): void {
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
    const relationshipsByEndpoint = new Map<string, Relationship[]>();
    for (const relationship of relationships) {
      for (const endpoint of new Set([relationship.source, relationship.target])) {
        if (!endpoint) continue;
        if (!relationshipsByEndpoint.has(endpoint)) relationshipsByEndpoint.set(endpoint, []);
        relationshipsByEndpoint.get(endpoint)!.push(relationship);
      }
    }

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

      const typeIssue = source && target
        ? this.relationshipTypeIssue(relationship, source, target, id => endpoints.get(id), id => relationshipsByEndpoint.get(id) || [])
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
      endpoint.id === relationship.id ||
      (endpoint as Relationship).source === other.id ||
      (endpoint as Relationship).target === other.id;
    if ((isRelationship(target) && connects(target, source)) || (isRelationship(source) && connects(source, target))) {
      return {
        code: 'relationship-endpoint-not-allowed',
        message: `${label} cannot connect "${source.id}" to "${target.id}": a relationship cannot connect to itself or to one of its own endpoints.`,
      };
    }

    // Unknown relationship and element types are not checked here; they are reported as unknown-type.
    if (!(Object.values(relationshipMatrixKeys) as string[]).includes(type)) return null;
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
        const linked = side === 'source'
          ? (other.target === junction.id ? lookup(other.source) : undefined)
          : (other.source === junction.id ? lookup(other.target) : undefined);
        if (!linked) continue;
        const [from, to] = side === 'source' ? [linked, target] : [source, linked];
        if (!isAllowed(from, to)) {
          return {
            code: 'relationship-type-not-allowed',
            message: `${label} of type ${relationship.type} is not allowed from ${from.type} "${from.id}" to ${to.type} "${to.id}" through Junction "${junction.id}".`,
          };
        }
      }

      const mismatch = others.find(other =>
        !isGroupingOrLocationStructural(lookup(other.source), other.type) && other.type !== type
      );
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

      const children = (Array.isArray(viewElement.child) ? viewElement.child : [viewElement.child]) as StoredViewChild[];
      const childIds = new Set<string>();
      const connectionIds = new Set<string>();

      this.collectViewIds(children, viewPath, childIds, connectionIds, seenIds, issues);
      // Connections can start or end on other connections, e.g. a relationship drawn onto a relationship.
      const endpointIds = new Set([...childIds, ...connectionIds]);
      this.validateViewChildren(children, viewPath, { modelElementIds, relationshipIds, viewIds, endpointIds, connectionIds }, issues);
    }
  }

  private collectViewIds(
    children: StoredViewChild[],
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

      this.collectViewIds(this.getNestedChildren(child), childPath, childIds, connectionIds, seenIds, issues);
    }
  }

  private validateViewChildren(
    children: StoredViewChild[],
    path: string,
    ids: ViewValidationIds,
    issues: PendingIssue[]
  ): void {
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

      this.validateViewChildren(this.getNestedChildren(child), childPath, ids, issues);
    }
  }

  private validateTargetConnections(
    owner: { id: string; targetConnections?: string | string[] },
    label: string,
    path: string,
    connectionIds: Set<string>,
    issues: PendingIssue[]
  ): void {
    for (const targetConnectionId of this.getTargetConnectionIds(owner)) {
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
    connection: ViewConnection,
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

  private getSourceConnections(child: StoredViewChild): StoredViewConnection[] {
    const sourceConnections = child.sourceConnections || [];
    const sourceConnection = (child as Child).sourceConnection;
    if (!sourceConnection) return sourceConnections;
    const parsed = Array.isArray(sourceConnection) ? sourceConnection : [sourceConnection];
    return [...sourceConnections, ...(parsed as StoredViewConnection[])];
  }

  /**
   * The child's connections, including connections nested in them (connection-to-connection).
   */
  private getAllSourceConnections(child: StoredViewChild): StoredViewConnection[] {
    return this.flattenConnections(this.getSourceConnections(child));
  }

  /**
   * The connections and every connection nested in them.
   */
  private flattenConnections(connections: StoredViewConnection[]): StoredViewConnection[] {
    return connections.flatMap(connection => {
      const nested = connection.sourceConnection;
      if (!nested) return [connection];
      return [connection, ...this.flattenConnections(Array.isArray(nested) ? nested : [nested])];
    });
  }

  private getTargetConnectionIds(owner: { targetConnections?: string | string[] }): string[] {
    if (!owner.targetConnections) return [];
    // Archi stores multiple target connections as a single space-separated attribute.
    return Array.isArray(owner.targetConnections)
      ? owner.targetConnections
      : owner.targetConnections.split(/\s+/).filter(Boolean);
  }
}
