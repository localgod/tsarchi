import type { Model, FolderKey } from './interfaces/Model.mjs';
import type { Schema as ArchimateSchema } from './interfaces/schema/Schema.mjs';
import type { Element } from './interfaces/Element.mjs';
import type { View } from './interfaces/View.mjs';
import type { Bounds } from './interfaces/Bounds.mjs';
import { Parser } from './Parser.mjs'
import { Serializer } from './Serializer.mjs'
import { ViewManager } from './ViewManager.mjs'
import { folderType, elementTypeToFolderKey } from './constants/archimate-mappings.mjs';

export class Archimate {

  private name: string

  private model: Model

  private viewManager: ViewManager

  public constructor() {
    this.name = ''
    this.model = this.init()
    this.viewManager = new ViewManager(this.model)
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
        element.id = this.generateRandomId();
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

  public parse(input: ArchimateSchema): void {
    const parser = new Parser(this.model);
    this.model = parser.parse(input);
    this.name = input['archimate:model']?.['@_name'] || 'Unnamed Model';
  }

  public serialize(): ArchimateSchema {
    const serializer = new Serializer(this.model)
    return serializer.serialize(this.name)
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
  public findElementsByType(elementType: string): Element[] {
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
  public createViewByElementType(viewName: string, elementType: string, options?: {
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
}
