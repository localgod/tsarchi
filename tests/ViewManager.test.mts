import { describe, it, expect, beforeEach } from 'vitest';
import { Archimate } from '../src/Archimate.mjs';
import type { Element } from '../src/interfaces/Element.mjs';

describe('ViewManager', () => {
  let archimate: Archimate;

  beforeEach(() => {
    archimate = new Archimate();
    
    // Add some test elements
    const appComponent1: Element = {
      id: 'app-1',
      type: 'ApplicationComponent',
      name: 'App Component 1',
      properties: new Map([['version', '1.0']])
    };
    
    const appComponent2: Element = {
      id: 'app-2',
      type: 'ApplicationComponent',
      name: 'App Component 2',
      properties: new Map([['version', '2.0']])
    };

    const businessProcess: Element = {
      id: 'bp-1',
      type: 'BusinessProcess',
      name: 'Business Process 1'
    };

    const relationship: Element = {
      id: 'rel-1',
      type: 'FlowRelationship',
      name: 'Flow',
      source: 'app-1',
      target: 'app-2'
    };

    archimate.upsertElement(appComponent1);
    archimate.upsertElement(appComponent2);
    archimate.upsertElement(businessProcess);
    archimate.upsertElement(relationship);
  });

  describe('createView', () => {
    it('should create a new view with basic properties', () => {
      const view = archimate.createView('Test View', {
        documentation: 'Test documentation',
        viewpoint: 'application'
      });

      expect(view).toBeDefined();
      expect(view.name).toBe('Test View');
      expect(view.type).toBe('ArchimateDiagramModel');
      expect(view.documentation).toBe('Test documentation');
      expect(view.viewpoint).toBe('application');
      expect(view.children).toEqual([]);
    });

    it('should add the view to the diagrams folder', () => {
      const view = archimate.createView('Test View');
      const views = archimate.listViews();
      
      expect(views).toHaveLength(1);
      expect(views[0].id).toBe(view.id);
      expect(views[0].name).toBe('Test View');
    });
  });

  describe('addDiagramObject', () => {
    it('should add a diagram object to a view', () => {
      const view = archimate.createView('Test View');
      const bounds = { x: 100, y: 100, width: 120, height: 55 };
      
      const diagramObject = archimate.addDiagramObject(view.id, 'app-1', bounds, {
        fillColor: '#ff0000',
        textAlignment: 1
      });

      expect(diagramObject).toBeDefined();
      expect(diagramObject?.type).toBe('DiagramObject');
      expect(diagramObject?.archimateElement).toBe('app-1');
      expect(diagramObject?.bounds).toEqual(bounds);
      expect(diagramObject?.fillColor).toBe('#ff0000');
      expect(diagramObject?.textAlignment).toBe(1);
    });

    it('should throw error for non-existent element', () => {
      const view = archimate.createView('Test View');
      const bounds = { x: 100, y: 100, width: 120, height: 55 };
      
      expect(() => {
        archimate.addDiagramObject(view.id, 'non-existent', bounds);
      }).toThrow('Element with ID non-existent not found in model');
    });

    it('should return null for non-existent view', () => {
      const bounds = { x: 100, y: 100, width: 120, height: 55 };
      const result = archimate.addDiagramObject('non-existent-view', 'app-1', bounds);
      
      expect(result).toBeNull();
    });
  });

  describe('addGroup', () => {
    it('should add a group to a view', () => {
      const view = archimate.createView('Test View');
      const bounds = { x: 50, y: 50, width: 300, height: 200 };
      
      const group = archimate.addGroup(view.id, 'Test Group', bounds, {
        fillColor: '#0000ff',
        documentation: 'Group documentation'
      });

      expect(group).toBeDefined();
      expect(group?.type).toBe('Group');
      expect(group?.name).toBe('Test Group');
      expect(group?.bounds).toEqual(bounds);
      expect(group?.fillColor).toBe('#0000ff');
      expect(group?.documentation).toBe('Group documentation');
      expect(group?.children).toEqual([]);
    });
  });

  describe('addDiagramObjectToGroup', () => {
    it('should add a diagram object to a group', () => {
      const view = archimate.createView('Test View');
      const groupBounds = { x: 50, y: 50, width: 300, height: 200 };
      const group = archimate.addGroup(view.id, 'Test Group', groupBounds);
      
      const objectBounds = { x: 20, y: 20, width: 120, height: 55 };
      const diagramObject = archimate.addDiagramObjectToGroup(
        view.id, 
        group!.id, 
        'app-1', 
        objectBounds
      );

      expect(diagramObject).toBeDefined();
      expect(diagramObject?.archimateElement).toBe('app-1');
      expect(diagramObject?.bounds).toEqual(objectBounds);
      
      // Verify the object is in the group
      const updatedView = archimate.getView(view.id);
      const updatedGroup = updatedView?.children?.[0] as any;
      expect(updatedGroup.children).toHaveLength(1);
      expect(updatedGroup.children[0].id).toBe(diagramObject?.id);
    });
  });

  describe('addConnection', () => {
    it('should create a connection between diagram objects', () => {
      const view = archimate.createView('Test View');
      const bounds1 = { x: 100, y: 100, width: 120, height: 55 };
      const bounds2 = { x: 300, y: 100, width: 120, height: 55 };
      
      const obj1 = archimate.addDiagramObject(view.id, 'app-1', bounds1);
      const obj2 = archimate.addDiagramObject(view.id, 'app-2', bounds2);
      
      const connection = archimate.addConnection(
        view.id, 
        obj1!.id, 
        obj2!.id, 
        'rel-1',
        { lineColor: '#00ff00', lineWidth: 2 }
      );

      expect(connection).toBeDefined();
      expect(connection?.type).toBe('Connection');
      expect(connection?.source).toBe(obj1!.id);
      expect(connection?.target).toBe(obj2!.id);
      expect(connection?.archimateRelationship).toBe('rel-1');
      expect(connection?.lineColor).toBe('#00ff00');
      expect(connection?.lineWidth).toBe(2);
    });
  });

  describe('generateViewFromElements', () => {
    it('should generate a view with grid layout', () => {
      const view = archimate.generateViewFromElements(
        'Generated View',
        ['app-1', 'app-2', 'bp-1'],
        { layoutType: 'grid', includeRelationships: true }
      );

      expect(view).toBeDefined();
      expect(view?.name).toBe('Generated View');
      expect(view?.children).toHaveLength(3);
      
      // Check that elements are positioned in grid
      const children = view?.children as any[];
      expect(children[0].bounds.x).toBe(50);
      expect(children[0].bounds.y).toBe(50);
      expect(children[1].bounds.x).toBe(190); // 50 + 120 + 20 padding
      expect(children[1].bounds.y).toBe(50);
    });

    it('should generate a view with circular layout', () => {
      const view = archimate.generateViewFromElements(
        'Circular View',
        ['app-1', 'app-2'],
        { layoutType: 'circular' }
      );

      expect(view).toBeDefined();
      expect(view?.children).toHaveLength(2);
      
      // Check that elements are positioned in circle
      const children = view?.children as any[];
      // For 2 elements: radius = max(150, 2*20) = 150, center = 300
      // Element 0: cos(0) * 150 + 300 = 450
      // Element 1: cos(π) * 150 + 300 = 150
      expect(children[0].bounds.x).toBeCloseTo(450, 0); // cos(0) * radius + center
      expect(children[1].bounds.x).toBeCloseTo(150, 0); // cos(π) * radius + center
    });

    it('should include relationship connections when requested', () => {
      const view = archimate.generateViewFromElements(
        'Connected View',
        ['app-1', 'app-2'],
        { includeRelationships: true }
      );

      expect(view).toBeDefined();
      
      // Check that connections were created
      const children = view?.children as any[];
      const sourceObject = children.find(c => c.archimateElement === 'app-1');
      expect(sourceObject.sourceConnections).toHaveLength(1);
      expect(sourceObject.sourceConnections[0].archimateRelationship).toBe('rel-1');
    });
  });

  describe('createViewByElementType', () => {
    it('should create a view with all elements of specified type', () => {
      const view = archimate.createViewByElementType('Application Components', 'ApplicationComponent');

      expect(view).toBeDefined();
      expect(view?.name).toBe('Application Components');
      expect(view?.children).toHaveLength(2);
      
      const children = view?.children as any[];
      const elementIds = children.map(c => c.archimateElement);
      expect(elementIds).toContain('app-1');
      expect(elementIds).toContain('app-2');
    });

    it('should return null for non-existent element type', () => {
      const view = archimate.createViewByElementType('Non-existent', 'NonExistentType');
      expect(view).toBeNull();
    });
  });

  describe('createViewByFolder', () => {
    it('should create a view with all elements from specified folder', () => {
      const view = archimate.createViewByFolder('Application Layer', 'application');

      expect(view).toBeDefined();
      expect(view?.name).toBe('Application Layer');
      expect(view?.children).toHaveLength(2);
    });

    it('should return null for empty folder', () => {
      const view = archimate.createViewByFolder('Strategy Layer', 'strategy');
      expect(view).toBeNull();
    });
  });

  describe('updateDiagramObjectStyle', () => {
    it('should update diagram object visual properties', () => {
      const view = archimate.createView('Test View');
      const bounds = { x: 100, y: 100, width: 120, height: 55 };
      const obj = archimate.addDiagramObject(view.id, 'app-1', bounds);
      
      const newBounds = { x: 200, y: 200, width: 150, height: 75 };
      const success = archimate.updateDiagramObjectStyle(view.id, obj!.id, {
        fillColor: '#ffff00',
        bounds: newBounds,
        textAlignment: 2
      });

      expect(success).toBe(true);
      
      // Verify the changes
      const updatedView = archimate.getView(view.id);
      const updatedObj = updatedView?.children?.[0] as any;
      expect(updatedObj.fillColor).toBe('#ffff00');
      expect(updatedObj.bounds).toEqual(newBounds);
      expect(updatedObj.textAlignment).toBe(2);
    });
  });

  describe('deleteView', () => {
    it('should remove a view from the model', () => {
      const view = archimate.createView('Test View');
      expect(archimate.listViews()).toHaveLength(1);
      
      const success = archimate.deleteView(view.id);
      expect(success).toBe(true);
      expect(archimate.listViews()).toHaveLength(0);
    });

    it('should return false for non-existent view', () => {
      const success = archimate.deleteView('non-existent');
      expect(success).toBe(false);
    });
  });
});
