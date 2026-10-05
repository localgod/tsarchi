import type { View, ViewGroup, ViewDiagramObject, ViewConnection } from './interfaces/View.mjs';
import type { Element } from './interfaces/Element.mjs';
import type { Child } from './interfaces/Child.mjs';
import type { SourceConnection } from './interfaces/SourceConnection.mjs';
import type { Model } from './interfaces/Model.mjs';
import type { Bounds } from './interfaces/Bounds.mjs';
import { isArchimateViewType } from './constants/archimate-mappings.mjs';
import { removeFromNestedFolders } from './internal/NestedFolders.mjs';
import { toArray } from './internal/Arrays.mjs';
import { randomArchiId } from './internal/Ids.mjs';
import { splitIds, toViewChild, toViewConnection } from './internal/ViewChildMapper.mjs';

/**
 * Creates, reads and edits views. Views are stored in the shape they have in the file (`Child`, with nested `child`,
 * `sourceConnection` and space-separated `targetConnections`), whether they were loaded or built here. The methods
 * return copies in the `View` shape, so change a view through these methods rather than through what they return.
 */
export class ViewManager {
  private model: Model;
  private generateUniqueId: () => string;

  constructor(model: Model, generateUniqueId?: () => string) {
    this.model = model;
    this.generateUniqueId = generateUniqueId || randomArchiId;
  }

  /**
   * Creates a new view with the specified name and optional properties
   */
  createView(
    name: string,
    options?: {
      viewpoint?: string;
      background?: number;
      documentation?: string;
    }
  ): View {
    const element: Element = { id: this.generateUniqueId(), name, type: 'ArchimateDiagramModel', child: [] };
    if (options?.viewpoint !== undefined) element.viewpoint = options.viewpoint;
    if (options?.background !== undefined) element.background = options.background;
    if (options?.documentation !== undefined) element.documentation = options.documentation;

    if (!this.model.diagrams.elements) {
      this.model.diagrams.elements = [];
    }
    this.model.diagrams.elements.push(element);

    return this.elementToView(element);
  }

  /**
   * Retrieves a view by ID
   */
  getView(viewId: string): View | null {
    const viewElement = this.findView(viewId);
    return viewElement ? this.elementToView(viewElement) : null;
  }

  /**
   * Lists all views in the model (ArchiMate, sketch and canvas), optionally only those of one type
   */
  listViews(options?: { type?: View['type'] }): View[] {
    if (!this.model.diagrams.elements) return [];

    return this.model.diagrams.elements
      .filter(el => isArchimateViewType(el.type) && (options?.type === undefined || el.type === options.type))
      .map(el => this.elementToView(el));
  }

  /**
   * Adds a diagram object to a view, representing a model element
   */
  addDiagramObject(
    viewId: string,
    elementId: string,
    bounds: Bounds,
    options?: {
      fillColor?: string;
      lineColor?: string;
      fontColor?: string;
      textAlignment?: number;
    }
  ): ViewDiagramObject | null {
    const viewElement = this.findView(viewId);
    if (!viewElement) return null;

    const diagramObject = this.newDiagramObject(elementId, bounds, options);
    this.childrenOf(viewElement).push(diagramObject);
    return toViewChild(diagramObject) as ViewDiagramObject;
  }

  /**
   * Creates a group in a view to organize diagram objects
   */
  addGroup(
    viewId: string,
    name: string,
    bounds: Bounds,
    options?: {
      fillColor?: string;
      lineColor?: string;
      textAlignment?: number;
      documentation?: string;
    }
  ): ViewGroup | null {
    const viewElement = this.findView(viewId);
    if (!viewElement) return null;

    const group: Child = { id: this.generateUniqueId(), type: 'Group', name, bounds: { ...bounds }, ...options };
    this.childrenOf(viewElement).push(group);
    return toViewChild(group) as ViewGroup;
  }

  /**
   * Adds a diagram object to a group within a view
   */
  addDiagramObjectToGroup(
    viewId: string,
    groupId: string,
    elementId: string,
    bounds: Bounds,
    options?: {
      fillColor?: string;
      lineColor?: string;
      fontColor?: string;
      textAlignment?: number;
    }
  ): ViewDiagramObject | null {
    const viewElement = this.findView(viewId);
    if (!viewElement) return null;

    const group = this.findChild(this.childrenOf(viewElement), groupId);
    if (!group || group.type !== 'Group') {
      throw new Error(`Group with ID ${groupId} not found in view`);
    }

    const diagramObject = this.newDiagramObject(elementId, bounds, options);
    group.child = [...(group.child ?? []), diagramObject];
    return toViewChild(diagramObject) as ViewDiagramObject;
  }

  /**
   * Creates a connection between two diagram objects in a view
   */
  addConnection(
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
  ): ViewConnection | null {
    const viewElement = this.findView(viewId);
    if (!viewElement) return null;

    const children = this.childrenOf(viewElement);
    const sourceObject = this.findChild(children, sourceObjectId);
    const targetObject = this.findChild(children, targetObjectId);

    if (!sourceObject || !targetObject) {
      throw new Error('Source or target diagram object not found in view');
    }

    if (relationshipId) {
      // Verify the relationship exists in the model
      const relationship = this.findElementById(relationshipId);
      if (!relationship) {
        throw new Error(`Relationship with ID ${relationshipId} not found in model`);
      }
    }

    const connection: SourceConnection = {
      id: this.generateUniqueId(),
      type: 'Connection',
      source: sourceObjectId,
      target: targetObjectId,
      ...(relationshipId !== undefined && { archimateRelationship: relationshipId }),
      ...options,
    };

    sourceObject.sourceConnection = [...toArray(sourceObject.sourceConnection), connection];
    targetObject.targetConnections = [...splitIds(targetObject.targetConnections), connection.id].join(' ');

    return toViewConnection(connection);
  }

  /**
   * Auto-generates a view based on elements and their relationships
   */
  generateViewFromElements(
    name: string,
    elementIds: string[],
    options?: {
      includeRelationships?: boolean;
      layoutType?: 'hierarchical' | 'circular' | 'grid';
      viewpoint?: string;
    }
  ): View | null {
    const view = this.createView(name, { viewpoint: options?.viewpoint });

    const includeRelationships = options?.includeRelationships ?? true;
    const layoutType = options?.layoutType ?? 'grid';

    // Add diagram objects for each element
    const diagramObjects: ViewDiagramObject[] = [];
    elementIds.forEach((elementId, index) => {
      const bounds = this.calculateLayoutPosition(index, elementIds.length, layoutType);
      const diagramObject = this.addDiagramObject(view.id, elementId, bounds);
      if (diagramObject) {
        diagramObjects.push(diagramObject);
      }
    });

    // Add connections for relationships if requested
    if (includeRelationships) {
      this.addRelationshipConnections(view.id, elementIds, diagramObjects);
    }

    return this.getView(view.id);
  }

  /**
   * Updates visual properties of a diagram object
   */
  updateDiagramObjectStyle(
    viewId: string,
    objectId: string,
    style: {
      fillColor?: string;
      lineColor?: string;
      fontColor?: string;
      bounds?: Bounds;
      textAlignment?: number;
    }
  ): boolean {
    const viewElement = this.findView(viewId);
    if (!viewElement) return false;

    const diagramObject = this.findChild(this.childrenOf(viewElement), objectId);
    if (!diagramObject) return false;

    Object.assign(diagramObject, style, style.bounds && { bounds: { ...style.bounds } });
    return true;
  }

  /**
   * Removes a view from the model and from the nested folder that lists it.
   */
  deleteView(viewId: string): boolean {
    if (!this.model.diagrams.elements) return false;

    const index = this.model.diagrams.elements.findIndex(el => el.id === viewId);
    if (index === -1) return false;

    this.model.diagrams.elements.splice(index, 1);
    removeFromNestedFolders(this.model.diagrams.folders || [], new Set([viewId]));
    return true;
  }

  // Private helper methods

  private findView(viewId: string): Element | null {
    const viewElement = this.model.diagrams.elements?.find(el => el.id === viewId);
    return viewElement && isArchimateViewType(viewElement.type) ? viewElement : null;
  }

  /**
   * The view's top-level children, stored as an array so they can be added to.
   */
  private childrenOf(viewElement: Element): Child[] {
    const children = toArray(viewElement.child);
    viewElement.child = children;
    return children;
  }

  /**
   * Finds a diagram child at any depth.
   */
  private findChild(children: Child[] | undefined, childId: string): Child | null {
    for (const child of children ?? []) {
      if (child.id === childId) return child;
      const found = this.findChild(child.child, childId);
      if (found) return found;
    }
    return null;
  }

  private newDiagramObject(elementId: string, bounds: Bounds, options: Partial<Child> | undefined): Child {
    // Verify the element exists in the model
    if (!this.findElementById(elementId)) {
      throw new Error(`Element with ID ${elementId} not found in model`);
    }
    return { id: this.generateUniqueId(), type: 'DiagramObject', archimateElement: elementId, bounds: { ...bounds }, ...options };
  }

  private elementToView(element: Element): View {
    const { type } = element;
    if (!isArchimateViewType(type)) {
      throw new Error(`Element ${element.id} has type ${type}, which is not a view type`);
    }
    const view: View = {
      id: element.id,
      name: element.name,
      type,
      documentation: element.documentation,
      children: toArray(element.child).map(toViewChild),
      properties: element.properties && new Map(element.properties),
    };
    if (element.viewpoint !== undefined) view.viewpoint = element.viewpoint;
    if (element.background !== undefined) view.background = element.background;
    if (element.connectionRouterType !== undefined) view.connectionRouterType = element.connectionRouterType;
    if (element.features !== undefined) view.features = new Map(element.features);
    if (element.unrecognized !== undefined) view.unrecognized = structuredClone(element.unrecognized);
    return view;
  }

  private findElementById(elementId: string): Element | null {
    for (const folderKey of Object.keys(this.model) as Array<keyof Model>) {
      const folder = this.model[folderKey];
      if (folder.elements) {
        const element = folder.elements.find(el => el.id === elementId);
        if (element) return element;
      }
    }
    return null;
  }

  private calculateLayoutPosition(index: number, total: number, layoutType: 'hierarchical' | 'circular' | 'grid'): Bounds {
    const baseWidth = 120;
    const baseHeight = 55;
    const padding = 20;

    switch (layoutType) {
      case 'grid': {
        const cols = Math.ceil(Math.sqrt(total));
        const row = Math.floor(index / cols);
        const col = index % cols;
        return {
          x: col * (baseWidth + padding) + 50,
          y: row * (baseHeight + padding) + 50,
          width: baseWidth,
          height: baseHeight,
        };
      }

      case 'circular': {
        const angle = (2 * Math.PI * index) / total;
        const radius = Math.max(150, total * 20);
        return {
          x: Math.cos(angle) * radius + 300,
          y: Math.sin(angle) * radius + 300,
          width: baseWidth,
          height: baseHeight,
        };
      }

      case 'hierarchical':
        return {
          x: 50,
          y: index * (baseHeight + padding) + 50,
          width: baseWidth,
          height: baseHeight,
        };

      default:
        return { x: 50, y: 50, width: baseWidth, height: baseHeight };
    }
  }

  private addRelationshipConnections(viewId: string, elementIds: string[], diagramObjects: ViewDiagramObject[]): void {
    if (!this.model.relations.elements) return;

    // Find relationships between the elements in the view
    const ids = new Set(elementIds);
    const relationships = this.model.relations.elements.filter(
      rel => rel.source && rel.target && ids.has(rel.source) && ids.has(rel.target)
    );

    // The first diagram object of an element is connected, as with find()
    const objectsByElement = new Map<string, ViewDiagramObject>();
    for (const object of diagramObjects) {
      if (!objectsByElement.has(object.archimateElement)) objectsByElement.set(object.archimateElement, object);
    }

    relationships.forEach(relationship => {
      const sourceObject = objectsByElement.get(relationship.source!);
      const targetObject = objectsByElement.get(relationship.target!);

      if (sourceObject && targetObject) {
        this.addConnection(viewId, sourceObject.id, targetObject.id, relationship.id);
      }
    });
  }
}
