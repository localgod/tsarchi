import type { Model, FolderKey } from './interfaces/Model.mjs';
import type { Schema as ArchimateSchema } from './interfaces/schema/Schema.mjs';
import type { Model as SchemaModel } from './interfaces/schema/Model.mjs';
import type { XmlMetadata } from './interfaces/schema/XmlMetadata.mjs';
import type { Element } from './interfaces/Element.mjs';
import type { Relationship, RelationshipInput } from './interfaces/Relationship.mjs';
import type { Child } from './interfaces/Child.mjs';
import type { View, ViewConnection, ViewDiagramObject } from './interfaces/View.mjs';
import type { Bounds } from './interfaces/Bounds.mjs';
import { ArchimateValidationError } from './interfaces/ValidationIssue.mjs';
import type { ValidationIssue } from './interfaces/ValidationIssue.mjs';
import { Parser } from './Parser.mjs'
import { Serializer } from './Serializer.mjs'
import { ViewManager } from './ViewManager.mjs'
import { folderType, elementTypeToFolderKey, isArchimateModelType } from './constants/archimate-mappings.mjs';
import type { ArchimateModelType, ArchimateRelationshipAliasType, ArchimateRelationshipType } from './constants/archimate-mappings.mjs';

type StoredViewChild = Omit<Child, 'child' | 'targetConnections'> & {
  archimateElement?: string;
  children?: StoredViewChild[];
  child?: StoredViewChild[];
  sourceConnections?: ViewConnection[];
  targetConnections?: string | string[];
};

export class Archimate {

  private name: string

  private xmlMetadata: XmlMetadata

  private modelMetadata: Omit<SchemaModel, 'folder'>

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

  private defaultModelMetadata(): Omit<SchemaModel, 'folder'> {
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
   * Updates are matched on `name` + `type`, not `id`.
   * When updating, existing `id` is preserved.
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

    const existingIndex = folder.elements.findIndex(
      e => e.name === element.name && e.type === element.type
    );

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
   * connections that reference it.
   */
  public deleteElement(elementId: string): boolean {
    const location = this.findElementLocationById(elementId);
    if (!location) return false;

    const deletedElement = location.element;
    location.folder.elements!.splice(location.index, 1);

    const removedRelationshipIds = new Set<string>();
    if (location.folderKey !== 'relations') {
      for (const relationship of this.removeRelationshipsForElement(elementId)) {
        removedRelationshipIds.add(relationship.id);
      }
      for (const relationshipId of removedRelationshipIds) {
        this.removeViewConnectionsForRelationship(relationshipId);
      }
      this.removeDiagramObjectsForElement(elementId);
    } else {
      removedRelationshipIds.add(deletedElement.id);
      this.removeViewConnectionsForRelationship(deletedElement.id);
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

    this.validateRelationships(modelElementIds, issues);
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
    const defaultModelMetadata = this.defaultModelMetadata();
    this.xmlMetadata = input['?xml'] || this.defaultXmlMetadata();
    this.modelMetadata = {
      ...defaultModelMetadata,
      '@_xmlns:xsi': input['archimate:model']?.['@_xmlns:xsi'] || defaultModelMetadata['@_xmlns:xsi'],
      '@_xmlns:archimate': input['archimate:model']?.['@_xmlns:archimate'] || defaultModelMetadata['@_xmlns:archimate'],
      '@_name': this.name,
      '@_id': input['archimate:model']?.['@_id'] || defaultModelMetadata['@_id'],
      '@_version': input['archimate:model']?.['@_version'] || defaultModelMetadata['@_version'],
    };
  }

  public serialize(): ArchimateSchema {
    const serializer = new Serializer(this.model)
    return serializer.serialize(this.modelMetadata, this.xmlMetadata)
  }

  // View Management API

  /**
   * Creates a new view with the specified name and optional properties
   */
  public createView(name: string, options?: {
    viewpoint?: string;
    background?: string;
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
   * Lists all views in the model
   */
  public listViews(): View[] {
    return this.viewManager.listViews();
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
   * Removes a view from the model
   */
  public deleteView(viewId: string): boolean {
    return this.viewManager.deleteView(viewId);
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

  private removeRelationshipsForElement(elementId: string): Element[] {
    const relationships = this.model.relations.elements || [];
    const removedRelationships: Element[] = [];

    this.model.relations.elements = relationships.filter(relationship => {
      const shouldRemove = relationship.source === elementId || relationship.target === elementId;
      if (shouldRemove) removedRelationships.push(relationship);
      return !shouldRemove;
    });

    return removedRelationships;
  }

  private removeDiagramObjectsForElement(elementId: string): void {
    for (const viewElement of this.model.diagrams.elements || []) {
      if (!viewElement.child) continue;

      const children = (Array.isArray(viewElement.child) ? viewElement.child : [viewElement.child]) as StoredViewChild[];
      viewElement.child = this.removeDiagramObjectsFromChildren(children, elementId) as Child[];
    }
  }

  private removeDiagramObjectsFromChildren(children: StoredViewChild[], elementId: string): StoredViewChild[] {
    const keptChildren: StoredViewChild[] = [];

    for (const child of children) {
      if (child.type === 'DiagramObject' && (child as ViewDiagramObject).archimateElement === elementId) {
        continue;
      }

      if (child.type === 'Group') {
        this.updateNestedChildren(child, this.removeDiagramObjectsFromChildren(
          this.getNestedChildren(child),
          elementId
        ));
      }

      keptChildren.push(child);
    }

    return keptChildren;
  }

  private removeViewConnectionsForRelationship(relationshipId: string): void {
    for (const viewElement of this.model.diagrams.elements || []) {
      if (!viewElement.child) continue;

      const children = (Array.isArray(viewElement.child) ? viewElement.child : [viewElement.child]) as StoredViewChild[];
      this.removeViewConnectionsFromChildren(children, relationshipId);
    }
  }

  private removeViewConnectionsFromChildren(children: StoredViewChild[], relationshipId: string): void {
    for (const child of children) {
      if (child.type === 'DiagramObject') {
        const diagramObject = child as ViewDiagramObject;
        const removedConnectionIds = new Set<string>();

        diagramObject.sourceConnections = diagramObject.sourceConnections?.filter(connection => {
          const shouldRemove = connection.archimateRelationship === relationshipId;
          if (shouldRemove) removedConnectionIds.add(connection.id);
          return !shouldRemove;
        });

        if (removedConnectionIds.size > 0) {
          this.removeTargetConnectionReferences(children, removedConnectionIds);
        }
      } else if (child.type === 'Group') {
        this.removeViewConnectionsFromChildren(this.getNestedChildren(child), relationshipId);
      }
    }
  }

  private removeTargetConnectionReferences(children: StoredViewChild[], connectionIds: Set<string>): void {
    for (const child of children) {
      if (child.type === 'DiagramObject') {
        if (Array.isArray(child.targetConnections)) {
          child.targetConnections = child.targetConnections.filter(id => !connectionIds.has(id));
        } else if (child.targetConnections && connectionIds.has(child.targetConnections)) {
          delete child.targetConnections;
        }
      } else if (child.type === 'Group') {
        this.removeTargetConnectionReferences(this.getNestedChildren(child), connectionIds);
      }
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

  private assertRelationshipType(type: ArchimateModelType): asserts type is ArchimateRelationshipType | ArchimateRelationshipAliasType {
    if (elementTypeToFolderKey.get(type) !== 'relations') {
      throw new Error(`Unknown relationship type "${type}".`);
    }
  }

  private assertRelationshipEndpointExists(elementId: string, endpoint: 'source' | 'target'): void {
    const element = this.getElement(elementId);
    if (!element || elementTypeToFolderKey.get(element.type) === 'relations') {
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

    if (!element.name) {
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

  private validateRelationships(modelElementIds: Set<string>, issues: ValidationIssue[]): void {
    for (const [index, relationship] of (this.model.relations.elements || []).entries()) {
      const path = `folder.relations.elements[${index}]`;

      if (relationship.source && !modelElementIds.has(relationship.source)) {
        issues.push({
          code: 'relationship-missing-source',
          message: `Relationship "${relationship.id}" references missing source element "${relationship.source}".`,
          path,
          id: relationship.id,
        });
      }

      if (relationship.target && !modelElementIds.has(relationship.target)) {
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
    for (const [viewIndex, viewElement] of (this.model.diagrams.elements || []).entries()) {
      const viewPath = `folder.diagrams.elements[${viewIndex}]`;
      if (!viewElement.child) continue;

      const children = (Array.isArray(viewElement.child) ? viewElement.child : [viewElement.child]) as StoredViewChild[];
      const childIds = new Set<string>();
      const connectionIds = new Set<string>();

      this.collectViewIds(children, viewPath, childIds, connectionIds, seenIds, issues);
      this.validateViewChildren(children, viewPath, modelElementIds, relationshipIds, childIds, connectionIds, issues);
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

      for (const connection of this.getSourceConnections(child)) {
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
    modelElementIds: Set<string>,
    relationshipIds: Set<string>,
    childIds: Set<string>,
    connectionIds: Set<string>,
    issues: ValidationIssue[]
  ): void {
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

      for (const connection of this.getSourceConnections(child)) {
        this.validateViewConnection(connection, childPath, relationshipIds, childIds, issues);
      }

      for (const targetConnectionId of this.getTargetConnectionIds(child)) {
        if (!connectionIds.has(targetConnectionId)) {
          issues.push({
            code: 'view-target-connection-missing-source',
            message: `Diagram object "${child.id}" references missing target connection "${targetConnectionId}".`,
            path: childPath,
            id: child.id,
          });
        }
      }

      this.validateViewChildren(
        this.getNestedChildren(child),
        childPath,
        modelElementIds,
        relationshipIds,
        childIds,
        connectionIds,
        issues
      );
    }
  }

  private validateViewConnection(
    connection: ViewConnection,
    path: string,
    relationshipIds: Set<string>,
    childIds: Set<string>,
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

    if (connection.source && !childIds.has(connection.source)) {
      issues.push({
        code: 'view-connection-missing-source',
        message: `View connection "${connection.id}" references missing source object "${connection.source}".`,
        path,
        id: connection.id,
      });
    }

    if (connection.target && !childIds.has(connection.target)) {
      issues.push({
        code: 'view-connection-missing-target',
        message: `View connection "${connection.id}" references missing target object "${connection.target}".`,
        path,
        id: connection.id,
      });
    }
  }

  private getSourceConnections(child: StoredViewChild): ViewConnection[] {
    const sourceConnections = child.sourceConnections || [];
    const sourceConnection = (child as Child).sourceConnection;
    return sourceConnection ? [...sourceConnections, sourceConnection as ViewConnection] : sourceConnections;
  }

  private getTargetConnectionIds(child: StoredViewChild): string[] {
    if (!child.targetConnections) return [];
    return Array.isArray(child.targetConnections) ? child.targetConnections : [child.targetConnections];
  }
}
