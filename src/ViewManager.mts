import type { View, ViewGroup, ViewDiagramObject, ViewConnection } from './interfaces/View.mjs';
import type { ViewChild } from './interfaces/ViewChild.mjs';
import type { Element } from './interfaces/Element.mjs';
import type { Model } from './interfaces/Model.mjs';
import type { Bounds } from './interfaces/Bounds.mjs';

export class ViewManager {
  private model: Model;

  constructor(model: Model) {
    this.model = model;
  }

  /**
   * Creates a new view with the specified name and optional properties
   */
  createView(name: string, options?: {
    viewpoint?: string;
    background?: string;
    documentation?: string;
  }): View {
    const view: View = {
      id: this.generateId(),
      name,
      type: 'ArchimateDiagramModel',
      children: [],
      ...options
    };

    // Convert to Element format for storage in diagrams folder
    const viewElement: Element = {
      id: view.id,
      name: view.name,
      type: view.type,
      documentation: view.documentation,
      child: view.children,
      properties: view.properties
    };

    if (!this.model.diagrams.elements) {
      this.model.diagrams.elements = [];
    }
    this.model.diagrams.elements.push(viewElement);

    return view;
  }

  /**
   * Retrieves a view by ID
   */
  getView(viewId: string): View | null {
    const viewElement = this.model.diagrams.elements?.find(el => el.id === viewId);
    if (!viewElement) return null;

    return this.elementToView(viewElement);
  }

  /**
   * Lists all views in the model
   */
  listViews(): View[] {
    if (!this.model.diagrams.elements) return [];
    
    return this.model.diagrams.elements
      .filter(el => el.type === 'ArchimateDiagramModel')
      .map(el => this.elementToView(el));
  }

  /**
   * Adds a diagram object to a view, representing a model element
   */
  addDiagramObject(viewId: string, elementId: string, bounds: Bounds, options?: {
    fillColor?: string;
    lineColor?: string;
    fontColor?: string;
    textAlignment?: number;
  }): ViewDiagramObject | null {
    const view = this.getView(viewId);
    if (!view) return null;

    // Verify the element exists in the model
    const element = this.findElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID ${elementId} not found in model`);
    }

    const diagramObject: ViewDiagramObject = {
      id: this.generateId(),
      type: 'DiagramObject',
      archimateElement: elementId,
      bounds,
      targetConnections: [],
      sourceConnections: [],
      ...options
    };

    if (!view.children) view.children = [];
    view.children.push(diagramObject);

    this.updateViewInModel(view);
    return diagramObject;
  }

  /**
   * Creates a group in a view to organize diagram objects
   */
  addGroup(viewId: string, name: string, bounds: Bounds, options?: {
    fillColor?: string;
    lineColor?: string;
    textAlignment?: number;
    documentation?: string;
  }): ViewGroup | null {
    const view = this.getView(viewId);
    if (!view) return null;

    const group: ViewGroup = {
      id: this.generateId(),
      type: 'Group',
      name,
      bounds,
      children: [],
      ...options
    };

    if (!view.children) view.children = [];
    view.children.push(group);

    this.updateViewInModel(view);
    return group;
  }

  /**
   * Adds a diagram object to a group within a view
   */
  addDiagramObjectToGroup(viewId: string, groupId: string, elementId: string, bounds: Bounds, options?: {
    fillColor?: string;
    lineColor?: string;
    fontColor?: string;
    textAlignment?: number;
  }): ViewDiagramObject | null {
    const view = this.getView(viewId);
    if (!view) return null;

    const group = this.findChildById(view.children, groupId) as ViewGroup;
    if (!group || group.type !== 'Group') {
      throw new Error(`Group with ID ${groupId} not found in view`);
    }

    // Verify the element exists in the model
    const element = this.findElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID ${elementId} not found in model`);
    }

    const diagramObject: ViewDiagramObject = {
      id: this.generateId(),
      type: 'DiagramObject',
      archimateElement: elementId,
      bounds,
      targetConnections: [],
      sourceConnections: [],
      ...options
    };

    if (!group.children) group.children = [];
    group.children.push(diagramObject);

    this.updateViewInModel(view);
    return diagramObject;
  }

  /**
   * Creates a connection between two diagram objects in a view
   */
  addConnection(viewId: string, sourceObjectId: string, targetObjectId: string, relationshipId?: string, options?: {
    lineColor?: string;
    lineWidth?: number;
    fontColor?: string;
    textPosition?: number;
  }): ViewConnection | null {
    const view = this.getView(viewId);
    if (!view) return null;

    const sourceObject = this.findChildById(view.children, sourceObjectId) as ViewDiagramObject;
    const targetObject = this.findChildById(view.children, targetObjectId) as ViewDiagramObject;

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

    const connection: ViewConnection = {
      id: this.generateId(),
      type: 'Connection',
      source: sourceObjectId,
      target: targetObjectId,
      archimateRelationship: relationshipId,
      ...options
    };

    if (!sourceObject.sourceConnections) sourceObject.sourceConnections = [];
    sourceObject.sourceConnections.push(connection);

    if (!targetObject.targetConnections) targetObject.targetConnections = [];
    targetObject.targetConnections.push(connection.id);

    this.updateViewInModel(view);
    return connection;
  }

  /**
   * Auto-generates a view based on elements and their relationships
   */
  generateViewFromElements(name: string, elementIds: string[], options?: {
    includeRelationships?: boolean;
    layoutType?: 'hierarchical' | 'circular' | 'grid';
    viewpoint?: string;
  }): View | null {
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

    return view;
  }

  /**
   * Updates visual properties of a diagram object
   */
  updateDiagramObjectStyle(viewId: string, objectId: string, style: {
    fillColor?: string;
    lineColor?: string;
    fontColor?: string;
    bounds?: Bounds;
    textAlignment?: number;
  }): boolean {
    const view = this.getView(viewId);
    if (!view) return false;

    const diagramObject = this.findChildById(view.children, objectId);
    if (!diagramObject) return false;

    Object.assign(diagramObject, style);
    this.updateViewInModel(view);
    return true;
  }

  /**
   * Removes a view from the model
   */
  deleteView(viewId: string): boolean {
    if (!this.model.diagrams.elements) return false;

    const index = this.model.diagrams.elements.findIndex(el => el.id === viewId);
    if (index === -1) return false;

    this.model.diagrams.elements.splice(index, 1);
    return true;
  }

  // Private helper methods

  private generateId(): string {
    const characters = 'abcdef0123456789';
    const idLength = 32;
    let randomId = 'id-';

    for (let i = 0; i < idLength; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      randomId += characters.charAt(randomIndex);
    }

    return randomId;
  }

  private elementToView(element: Element): View {
    return {
      id: element.id,
      name: element.name,
      type: 'ArchimateDiagramModel',
      documentation: element.documentation,
      children: Array.isArray(element.child) ? element.child as ViewChild[] : element.child ? [element.child as ViewChild] : [],
      properties: element.properties
    };
  }

  private updateViewInModel(view: View): void {
    if (!this.model.diagrams.elements) return;

    const index = this.model.diagrams.elements.findIndex(el => el.id === view.id);
    if (index !== -1) {
      this.model.diagrams.elements[index] = {
        id: view.id,
        name: view.name,
        type: view.type,
        documentation: view.documentation,
        child: view.children,
        properties: view.properties
      };
    }
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

  private findChildById(children: ViewChild[] | undefined, childId: string): ViewChild | null {
    if (!children) return null;

    for (const child of children) {
      if (child.id === childId) return child;
      
      // Check if this is a group with children
      if (child.type === 'Group') {
        const group = child as ViewGroup;
        if (group.children) {
          const found = this.findChildById(group.children, childId);
          if (found) return found;
        }
      }
    }
    return null;
  }

  private calculateLayoutPosition(index: number, total: number, layoutType: 'hierarchical' | 'circular' | 'grid'): Bounds {
    const baseWidth = 120;
    const baseHeight = 55;
    const padding = 20;

    switch (layoutType) {
      case 'grid':
        const cols = Math.ceil(Math.sqrt(total));
        const row = Math.floor(index / cols);
        const col = index % cols;
        return {
          x: col * (baseWidth + padding) + 50,
          y: row * (baseHeight + padding) + 50,
          width: baseWidth,
          height: baseHeight
        };

      case 'circular':
        const angle = (2 * Math.PI * index) / total;
        const radius = Math.max(150, total * 20);
        return {
          x: Math.cos(angle) * radius + 300,
          y: Math.sin(angle) * radius + 300,
          width: baseWidth,
          height: baseHeight
        };

      case 'hierarchical':
        return {
          x: 50,
          y: index * (baseHeight + padding) + 50,
          width: baseWidth,
          height: baseHeight
        };

      default:
        return { x: 50, y: 50, width: baseWidth, height: baseHeight };
    }
  }

  private addRelationshipConnections(viewId: string, elementIds: string[], diagramObjects: ViewDiagramObject[]): void {
    if (!this.model.relations.elements) return;

    // Find relationships between the elements in the view
    const relationships = this.model.relations.elements.filter(rel => 
      rel.source && rel.target && 
      elementIds.includes(rel.source) && 
      elementIds.includes(rel.target)
    );

    relationships.forEach(relationship => {
      const sourceObject = diagramObjects.find(obj => obj.archimateElement === relationship.source);
      const targetObject = diagramObjects.find(obj => obj.archimateElement === relationship.target);

      if (sourceObject && targetObject) {
        this.addConnection(viewId, sourceObject.id, targetObject.id, relationship.id);
      }
    });
  }
}
