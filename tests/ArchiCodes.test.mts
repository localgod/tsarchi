import { describe, it, expect, beforeEach } from 'vite-plus/test';
import { Archimate } from '../src/Archimate.mjs';
import {
  AccessType,
  ConnectionRouterType,
  ConnectionTextPosition,
  DiagramObjectFigure,
  GroupBorderType,
  NoteBorderType,
  RelationshipDirection,
  TextAlignment,
  TextPosition,
  TopLevelFolder,
  TraversalDirection,
  Viewpoint,
} from '../src/constants/archi-codes.mjs';
import { ArchimateType, folderType } from '../src/constants/archimate-mappings.mjs';

const bounds = { x: 0, y: 0, width: 120, height: 55 };

describe('Archi codes', () => {
  let archimate: Archimate;

  beforeEach(() => {
    archimate = new Archimate();
    archimate.upsertElement({ id: 'app', name: 'App', type: ArchimateType.ApplicationComponent });
    archimate.upsertElement({ id: 'data', name: 'Data', type: ArchimateType.DataObject });
  });

  it('should freeze every code object', () => {
    for (const codes of [
      TopLevelFolder,
      RelationshipDirection,
      TraversalDirection,
      AccessType,
      TextAlignment,
      TextPosition,
      ConnectionTextPosition,
      ConnectionRouterType,
      GroupBorderType,
      NoteBorderType,
      DiagramObjectFigure,
      Viewpoint,
    ]) {
      expect(Object.isFrozen(codes)).toBe(true);
    }
  });

  it('should name every top-level folder', () => {
    expect(Object.values(TopLevelFolder).toSorted()).toEqual([...folderType.keys()].toSorted());
  });

  describe('folder methods', () => {
    it('should accept a TopLevelFolder value', () => {
      expect(archimate.findElementsByFolder(TopLevelFolder.Application)).toHaveLength(2);
      expect(archimate.getFolders(TopLevelFolder.Application)).toEqual([]);
      expect(archimate.getFolder(TopLevelFolder.Application).name).toBe('Application');
      expect(archimate.updateFolder(TopLevelFolder.Application, { documentation: 'Apps' }).documentation).toBe('Apps');
    });

    it.each([['findElementsByFolder'], ['getFolders'], ['getFolder']] as const)('%s should throw on an unknown folder', method => {
      expect(() => archimate[method]('Business' as any)).toThrowError('Unknown folder "Business"; expected one of "strategy", "business",');
      expect(() => archimate[method](undefined as any)).toThrowError('Unknown folder undefined;');
    });

    it('updateFolder should throw on an unknown folder', () => {
      expect(() => archimate.updateFolder('apps' as any, { name: 'Apps' })).toThrowError('Unknown folder "apps";');
    });
  });

  describe('relationship lookups', () => {
    beforeEach(() => {
      archimate.upsertRelationship({ id: 'access', name: '', type: ArchimateType.AccessRelationship, source: 'app', target: 'data' });
    });

    it('should accept RelationshipDirection values', () => {
      expect(archimate.findRelationshipsForElement('app', RelationshipDirection.Source)).toHaveLength(1);
      expect(archimate.findRelationshipsForElement('app', RelationshipDirection.Target)).toHaveLength(0);
    });

    it('should throw on an unknown direction', () => {
      expect(() => archimate.findRelationshipsForElement('app', 'targets' as any)).toThrowError(
        'Unknown direction "targets"; expected one of "source", "target", "both".'
      );
    });

    it('should throw on an unknown relationship type in findRelationshipsBetween', () => {
      expect(archimate.findRelationshipsBetween('app', 'data', { type: ArchimateType.AccessRelationship })).toHaveLength(1);
      expect(() => archimate.findRelationshipsBetween('app', 'data', { type: 'Access' as any })).toThrowError(
        'Unknown relationship type "Access".'
      );
      expect(() => archimate.findRelationshipsBetween('app', 'data', { type: ArchimateType.ApplicationComponent as any })).toThrowError(
        'Unknown relationship type "ApplicationComponent".'
      );
    });

    it('should accept an AccessType and throw on an unknown accessType', () => {
      const relationship = { name: '', type: ArchimateType.AccessRelationship, source: 'app', target: 'data' } as const;

      expect(archimate.upsertRelationship({ ...relationship, accessType: AccessType.ReadWrite }).accessType).toBe(3);
      expect(() => archimate.upsertRelationship({ ...relationship, accessType: 4 })).toThrowError(
        'Unknown accessType 4; expected one of 0, 1, 2, 3.'
      );
    });
  });

  describe('views', () => {
    it('should throw on an unknown view type in listViews', () => {
      archimate.createView('View');

      expect(archimate.listViews({ type: ArchimateType.ArchimateDiagramModel })).toHaveLength(1);
      expect(() => archimate.listViews({ type: 'ArchimateDiagram' as any })).toThrowError('Unknown view type "ArchimateDiagram".');
    });

    it('should accept a Viewpoint and throw on an unknown viewpoint', () => {
      expect(archimate.createView('Layered', { viewpoint: Viewpoint.Layered }).viewpoint).toBe('layered');
      expect(() => archimate.createView('Application', { viewpoint: 'application' })).toThrowError('Unknown viewpoint "application";');
    });

    it('should check textAlignment and textPosition options', () => {
      const view = archimate.createView('View');
      const app = archimate.addDiagramObject(view.id, 'app', bounds, { textAlignment: TextAlignment.Right })!;
      const data = archimate.addDiagramObject(view.id, 'data', { ...bounds, x: 200 })!;
      const group = archimate.addGroup(view.id, 'Group', { ...bounds, y: 200, width: 400, height: 200 })!;

      expect(app.textAlignment).toBe(4);
      expect(
        archimate.addConnection(view.id, app.id, data.id, undefined, { textPosition: ConnectionTextPosition.Target })?.textPosition
      ).toBe(2);
      expect(archimate.updateDiagramObjectStyle(view.id, app.id, { textAlignment: TextAlignment.Left })).toBe(true);

      expect(() => archimate.addDiagramObject(view.id, 'app', bounds, { textAlignment: 3 })).toThrowError(
        'Unknown textAlignment 3; expected one of 1, 2, 4.'
      );
      expect(() => archimate.addDiagramObjectToGroup(view.id, group.id, 'app', bounds, { textAlignment: 0 })).toThrowError(
        'Unknown textAlignment 0;'
      );
      expect(() => archimate.addGroup(view.id, 'Group', bounds, { textAlignment: 5 })).toThrowError('Unknown textAlignment 5;');
      expect(() => archimate.updateDiagramObjectStyle(view.id, app.id, { textAlignment: 8 })).toThrowError('Unknown textAlignment 8;');
      expect(() => archimate.addConnection(view.id, app.id, data.id, undefined, { textPosition: 3 })).toThrowError(
        'Unknown textPosition 3; expected one of 0, 1, 2.'
      );
    });
  });

  describe('updateElement and upsertElement', () => {
    it('should accept known codes and throw on unknown accessType, viewpoint and connectionRouterType', () => {
      const access = archimate.upsertRelationship({ name: '', type: ArchimateType.AccessRelationship, source: 'app', target: 'data' });
      const view = archimate.createView('View');

      expect(archimate.updateElement(access.id, { accessType: AccessType.Read })?.accessType).toBe(1);
      expect(archimate.updateElement(view.id, { viewpoint: Viewpoint.Layered })?.viewpoint).toBe('layered');
      expect(archimate.updateElement(view.id, { connectionRouterType: ConnectionRouterType.Manhattan })?.connectionRouterType).toBe(2);

      expect(() => archimate.updateElement(access.id, { accessType: 7 })).toThrowError('Unknown accessType 7; expected one of 0, 1, 2, 3.');
      expect(() => archimate.updateElement(view.id, { viewpoint: 'application' })).toThrowError('Unknown viewpoint "application";');
      expect(() => archimate.updateElement(view.id, { connectionRouterType: 1 })).toThrowError(
        'Unknown connectionRouterType 1; expected one of 0, 2.'
      );
      expect(() => archimate.upsertElement({ ...archimate.getElement(view.id)!, viewpoint: 'application' })).toThrowError(
        'Unknown viewpoint "application";'
      );
      expect(() =>
        archimate.upsertElement({ name: 'View', type: ArchimateType.ArchimateDiagramModel, connectionRouterType: 1 })
      ).toThrowError('Unknown connectionRouterType 1;');

      // Nothing was written
      expect(archimate.getElement(access.id)?.accessType).toBe(1);
      expect(archimate.getElement(view.id)).toMatchObject({ viewpoint: 'layered', connectionRouterType: 2 });
      expect(archimate.listViews()).toHaveLength(1);
    });

    it('should not check codes the patch leaves out, and still remove one set to undefined', () => {
      const view = archimate.createView('View', { viewpoint: Viewpoint.Layered });

      expect(archimate.updateElement(view.id, { name: 'Renamed' })?.viewpoint).toBe('layered');
      expect(archimate.updateElement(view.id, { viewpoint: undefined })?.viewpoint).toBeUndefined();
    });

    it('should still update a loaded view whose viewpoint Archi no longer offers', () => {
      const loaded = Archimate.fromXml(
        `<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="m" id="id-m" version="5.0.0">
  <folder name="Views" id="id-views" type="diagrams">
    <element xsi:type="archimate:ArchimateDiagramModel" name="View" id="id-view" viewpoint="retired"/>
  </folder>
</archimate:model>`
      );

      expect(loaded.updateElement('id-view', { name: 'Renamed' })).toMatchObject({ name: 'Renamed', viewpoint: 'retired' });
    });
  });
});
