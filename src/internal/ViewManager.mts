import type { View, ViewGroup, ViewDiagramObject, ViewConnection } from '../interfaces/View.mjs';
import type { Element } from '../interfaces/Element.mjs';
import type { Child } from '../interfaces/Child.mjs';
import type { SourceConnection } from '../interfaces/SourceConnection.mjs';
import type { Model } from '../interfaces/Model.mjs';
import type { Bounds } from '../interfaces/Bounds.mjs';
import { isArchimateViewType } from '../constants/archimate-mappings.mjs';
import { removeFromNestedFolders } from './NestedFolders.mjs';
import { toArray } from './Arrays.mjs';
import { deepCopy } from './Copy.mjs';
import { randomArchiId } from './Ids.mjs';
import { ModelIndex } from './ModelIndex.mjs';
import { splitIds, toViewChild, toViewConnection } from './ViewChildMapper.mjs';

/**
 * Creates, reads and edits views. Views are stored in the shape they have in the file (`Child`, with nested `child`,
 * `sourceConnection` and space-separated `targetConnections`), whether they were loaded or built here. The methods
 * return copies in the `View` shape, so change a view through these methods rather than through what they return.
 */
export class ViewManager {
  private model: Model;
  private generateUniqueId: () => string;
  /** Lookups by id, shared with the Archimate that owns the model; the methods below keep it current. */
  private index: ModelIndex;

  constructor(model: Model, generateUniqueId?: () => string, index?: ModelIndex) {
    this.model = model;
    this.generateUniqueId = generateUniqueId || randomArchiId;
    this.index = index || new ModelIndex(() => model);
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
    this.index.added('diagrams', element);

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
    this.index.addId(diagramObject.id);
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
    this.index.addId(group.id);
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
    this.index.addId(diagramObject.id);
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
    this.index.addId(connection.id);

    return toViewConnection(connection);
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
    this.index.clear();
    return true;
  }

  // Private helper methods

  private findView(viewId: string): Element | null {
    const entry = this.index.element(viewId);
    return entry?.folderKey === 'diagrams' && isArchimateViewType(entry.element.type) ? entry.element : null;
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
    if (element.unrecognized !== undefined) view.unrecognized = deepCopy(element.unrecognized);
    return view;
  }

  private findElementById(elementId: string): Element | null {
    return this.index.element(elementId)?.element ?? null;
  }
}
