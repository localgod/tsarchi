import type { Model, FolderKey } from './interfaces/Model.mjs';
import type { Schema as ArchimateSchema } from './interfaces/schema/Schema.mjs';
import type { ModelAttributes } from './interfaces/schema/Model.mjs';
import type { XmlMetadata } from './interfaces/schema/XmlMetadata.mjs';
import type { Element } from './interfaces/Element.mjs';
import type { Folder } from './interfaces/Folder.mjs';
import type { Relationship, RelationshipInput } from './interfaces/Relationship.mjs';
import type { Child } from './interfaces/Child.mjs';
import type { View, ViewConnection } from './interfaces/View.mjs';
import type { Bounds } from './interfaces/Bounds.mjs';
import { ArchimateValidationError } from './interfaces/ValidationIssue.mjs';
import type { ValidationIssue } from './interfaces/ValidationIssue.mjs';
import { Parser } from './Parser.mjs'
import { Serializer } from './Serializer.mjs'
import { ViewManager } from './ViewManager.mjs'
import { folderType, elementTypeToFolderKey, isArchimateModelType, canvasModelTypes, canvasNamespace } from './constants/archimate-mappings.mjs';
import type { ArchimateModelType, ArchimateRelationshipAliasType, ArchimateRelationshipType } from './constants/archimate-mappings.mjs';

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

  private purpose?: string

  private xmlMetadata: XmlMetadata

  private modelMetadata: ModelAttributes

  private model: Model

  private viewManager: ViewManager

  public constructor() {
    this.name = ''
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
      '@_xmlns:archimate': 'http://www.archimatetool.com/archimate',
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
   * diagram children, or view connections.
   */
  public hasId(id: string): boolean {
    if (!id) return false;

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
  public upsertRelationship(relationship: RelationshipInput): Relationship {
    this.assertRelationshipType(relationship.type);
    this.assertRelationshipEndpointExists(relationship.source, 'source');
    this.assertRelationshipEndpointExists(relationship.target, 'target');

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
      const typeMatch = options?.type ? relationship.type === options.type : true;

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
    const issues: ValidationIssue[] = [];
    const seenIds = new Map<string, string>();
    const modelElementIds = new Set<string>();
    const relationshipIds = new Set<string>();

    for (const folderKey of Object.keys(this.model) as FolderKey[]) {
      const folder = this.model[folderKey];
      this.recordId(folder.id, `folder.${folderKey}`, seenIds, issues);
      this.recordFolderIds(folder.folders || [], `folder.${folderKey}`, seenIds, issues);

      for (const [index, element] of (folder.elements || []).entries()) {
        const path = `folder.${folderKey}.elements[${index}]`;
        this.validateElementFields(element, path, issues);
        this.recordId(element.id, path, seenIds, issues);

        if (folderKey === 'relations') {
          relationshipIds.add(element.id);
        } else if (folderKey !== 'diagrams') {
          modelElementIds.add(element.id);
        }
      }
    }

    this.validateRelationships(new Set([...modelElementIds, ...relationshipIds]), issues);
    this.validateViews(modelElementIds, relationshipIds, seenIds, issues);

    return issues;
  }

  /**
   * Throws an ArchimateValidationError if validateModel finds issues.
   */
  public assertValidModel(): void {
    const issues = this.validateModel();
    if (issues.length > 0) {
      throw new ArchimateValidationError(issues);
    }
  }

  public parse(input: ArchimateSchema): void {
    const parser = new Parser(this.model);
    this.model = parser.parse(input);
    this.name = input['archimate:model']?.['@_name'] || 'Unnamed Model';
    const purpose = input['archimate:model']?.purpose;
    this.purpose = purpose !== undefined ? String(purpose) : undefined;
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
    return serializer.serialize(this.withRequiredNamespaces(this.modelMetadata), this.xmlMetadata, this.purpose)
  }

  /**
   * Returns the model's purpose text, if any.
   */
  public getPurpose(): string | undefined {
    return this.purpose;
  }

  /**
   * Sets the model's purpose text. Pass undefined or an empty string to remove it.
   */
  public setPurpose(purpose: string | undefined): void {
    this.purpose = purpose || undefined;
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
    issues: ValidationIssue[]
  ): void {
    for (const [index, folder] of folders.entries()) {
      const folderPath = `${path}.folders[${index}]`;
      this.recordId(folder.id, folderPath, seenIds, issues);
      this.recordFolderIds(folder.folders || [], folderPath, seenIds, issues);
    }
  }

  private assertRelationshipType(type: ArchimateModelType): asserts type is ArchimateRelationshipType | ArchimateRelationshipAliasType {
    if (elementTypeToFolderKey.get(type) !== 'relations') {
      throw new Error(`Unknown relationship type "${type}".`);
    }
  }

  private assertRelationshipEndpointExists(elementId: string, endpoint: 'source' | 'target'): void {
    const element = this.getElement(elementId);
    if (!element || elementTypeToFolderKey.get(element.type) === 'diagrams') {
      throw new Error(`Relationship ${endpoint} element "${elementId}" not found in model.`);
    }
  }

  private validateElementFields(element: Element, path: string, issues: ValidationIssue[]): void {
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

  private recordId(
    id: string | undefined,
    path: string,
    seenIds: Map<string, string>,
    issues: ValidationIssue[]
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
  private validateRelationships(endpointIds: Set<string>, issues: ValidationIssue[]): void {
    for (const [index, relationship] of (this.model.relations.elements || []).entries()) {
      const path = `folder.relations.elements[${index}]`;

      if (relationship.source && !endpointIds.has(relationship.source)) {
        issues.push({
          code: 'relationship-missing-source',
          message: `Relationship "${relationship.id}" references missing source element "${relationship.source}".`,
          path,
          id: relationship.id,
        });
      }

      if (relationship.target && !endpointIds.has(relationship.target)) {
        issues.push({
          code: 'relationship-missing-target',
          message: `Relationship "${relationship.id}" references missing target element "${relationship.target}".`,
          path,
          id: relationship.id,
        });
      }
    }
  }

  private validateViews(
    modelElementIds: Set<string>,
    relationshipIds: Set<string>,
    seenIds: Map<string, string>,
    issues: ValidationIssue[]
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
    issues: ValidationIssue[]
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
    issues: ValidationIssue[]
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
    issues: ValidationIssue[]
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
    issues: ValidationIssue[]
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
