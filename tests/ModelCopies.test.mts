import { describe, expect, it } from 'vite-plus/test';
import { Archimate } from '../src/Archimate.mjs';
import type { Child } from '../src/interfaces/Child.mjs';
import type { Element } from '../src/interfaces/Element.mjs';
import type { Profile } from '../src/interfaces/Profile.mjs';
import type { RelationshipInput } from '../src/interfaces/Relationship.mjs';

function modelWithTwoApps(): Archimate {
  const archimate = new Archimate();
  archimate.upsertElement({ id: 'app-a', name: 'A', type: 'ApplicationComponent' });
  archimate.upsertElement({ id: 'app-b', name: 'B', type: 'ApplicationComponent' });
  return archimate;
}

describe('objects passed to the model are copied', () => {
  it('should not set an id on the object given to upsertElement', () => {
    const archimate = new Archimate();
    const input = { name: 'CRM', type: 'ApplicationComponent' } as const;

    const stored = archimate.upsertElement(input);

    expect(input).not.toHaveProperty('id');
    expect(stored).not.toBe(input);
    expect(archimate.getElement(stored.id)?.name).toBe('CRM');
  });

  it('should add a second element when the same input object is passed again', () => {
    const archimate = new Archimate();
    const input = { name: 'CRM', type: 'ApplicationComponent' } as const;

    const first = archimate.upsertElement(input);
    const second = archimate.upsertElement(input);

    expect(second.id).not.toBe(first.id);
    expect(archimate.listElements()).toHaveLength(2);
  });

  it('should not change the model when the input to upsertElement is changed afterwards', () => {
    const archimate = new Archimate();
    const input: Partial<Element> & Pick<Element, 'name' | 'type'> = {
      name: 'CRM',
      type: 'ApplicationComponent',
      properties: new Map([['owner', 'Sales']]),
      features: new Map([['iconColor', '#ff0000']]),
    };

    const { id } = archimate.upsertElement(input);
    input.name = 'Changed';
    input.properties!.set('owner', 'Support');
    input.features!.set('iconColor', '#00ff00');

    expect(archimate.getElement(id)).toMatchObject({ name: 'CRM' });
    expect(archimate.getElement(id)?.properties?.get('owner')).toBe('Sales');
    expect(archimate.getElement(id)?.features?.get('iconColor')).toBe('#ff0000');
  });

  it('should not change the model when a patch is changed after an update', () => {
    const archimate = new Archimate();
    const { id } = archimate.upsertElement({ name: 'CRM', type: 'ApplicationComponent' });
    const features = new Map([['iconColor', '#ff0000']]);
    const profiles = ['profile-1'];

    archimate.upsertElement({ id, name: 'CRM', type: 'ApplicationComponent', features });
    archimate.updateElement(id, { profiles });
    features.set('iconColor', '#00ff00');
    profiles.push('profile-2');

    expect(archimate.getElement(id)?.features?.get('iconColor')).toBe('#ff0000');
    expect(archimate.getElement(id)?.profiles).toEqual(['profile-1']);
  });

  it('should not change the model when the input to upsertRelationship is changed afterwards', () => {
    const archimate = modelWithTwoApps();
    const input: RelationshipInput = {
      name: 'Data',
      type: 'FlowRelationship',
      source: 'app-a',
      target: 'app-b',
      properties: new Map([['kind', 'batch']]),
    };

    const { id } = archimate.upsertRelationship(input);
    input.properties!.set('kind', 'stream');

    expect(input).not.toHaveProperty('id');
    expect(archimate.getRelationship(id)?.properties?.get('kind')).toBe('batch');
  });
});

describe('objects returned by the model are copies', () => {
  function model(): Archimate {
    const archimate = modelWithTwoApps();
    archimate.updateElement('app-a', { properties: new Map([['owner', 'Sales']]) });
    archimate.upsertRelationship({ id: 'flow', name: 'Data', type: 'FlowRelationship', source: 'app-a', target: 'app-b' });
    return archimate;
  }

  const elementGetters: [string, (archimate: Archimate) => Element][] = [
    ['upsertElement', archimate => archimate.upsertElement({ id: 'app-a', name: 'A', type: 'ApplicationComponent' })],
    ['updateElement', archimate => archimate.updateElement('app-a', { documentation: 'Doc' })!],
    ['getElement', archimate => archimate.getElement('app-a')!],
    ['listElements', archimate => archimate.listElements()[0]],
    ['findElementsByName', archimate => archimate.findElementsByName('A')[0]],
    ['findElementsByType', archimate => archimate.findElementsByType('ApplicationComponent')[0]],
    ['findElementsByFolder', archimate => archimate.findElementsByFolder('application')[0]],
    ['findElementInFolderByName', archimate => archimate.findElementInFolderByName('application', 'A')!],
  ];

  it.each(elementGetters)('should not change the model when the element from %s is changed', (_, get) => {
    const archimate = model();
    const element = get(archimate);
    element.name = 'Changed';
    element.properties!.set('owner', 'Support');

    expect(archimate.getElement('app-a')?.name).toBe('A');
    expect(archimate.getElement('app-a')?.properties?.get('owner')).toBe('Sales');
  });

  const relationshipGetters: [string, (archimate: Archimate) => Element][] = [
    [
      'upsertRelationship',
      archimate => archimate.upsertRelationship({ id: 'flow', name: 'Data', type: 'FlowRelationship', source: 'app-a', target: 'app-b' }),
    ],
    ['getRelationship', archimate => archimate.getRelationship('flow')!],
    ['listRelationships', archimate => archimate.listRelationships()[0]],
    ['findRelationshipsForElement', archimate => archimate.findRelationshipsForElement('app-a')[0]],
    ['findRelationshipsBetween', archimate => archimate.findRelationshipsBetween('app-a', 'app-b')[0]],
  ];

  it.each(relationshipGetters)('should not change the model when the relationship from %s is changed', (_, get) => {
    const archimate = model();
    const relationship = get(archimate);
    relationship.target = 'app-a';

    expect(archimate.getRelationship('flow')?.target).toBe('app-b');
  });

  it.each(elementGetters)(
    'should not change the model when the features or unrecognized XML of the element from %s are changed',
    (_, get) => {
      const archimate = Archimate.fromXml(`<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="M" id="m" version="5.0.0">
  <folder name="Application" id="fa" type="application">
    <element xsi:type="archimate:ApplicationComponent" name="A" id="app-a" extra="1">
      <note text="x"/>
      <feature name="iconColor" value="#ff0000"/>
    </element>
  </folder>
</archimate:model>`);
      const element = get(archimate);
      element.features!.set('iconColor', '#00ff00');
      (element.unrecognized!.note as Record<string, string>)['@_text'] = 'changed';

      const stored = archimate.getElement('app-a')!;
      expect(stored.features?.get('iconColor')).toBe('#ff0000');
      expect(stored.unrecognized).toEqual({ note: { '@_text': 'x' }, '@_extra': '1' });
    }
  );

  const viewGetters: [string, (archimate: Archimate, viewId: string) => Element][] = [
    ['getElement', (archimate, viewId) => archimate.getElement(viewId)!],
    ['findElementsByName', archimate => archimate.findElementsByName('View')[0]],
    ['findElementsByType', archimate => archimate.findElementsByType('ArchimateDiagramModel')[0]],
    ['findElementsByFolder', archimate => archimate.findElementsByFolder('diagrams')[0]],
    ['findElementInFolderByName', archimate => archimate.findElementInFolderByName('diagrams', 'View')!],
  ];

  it.each(viewGetters)('should not change the model when a view from %s is changed', (_, get) => {
    const archimate = model();
    const view = archimate.createView('View');
    archimate.addDiagramObject(view.id, 'app-a', { x: 0, y: 0, width: 120, height: 55 });

    const element = get(archimate, view.id);
    (element.child as Child[])[0].fillColor = '#ff0000';

    expect(archimate.getView(view.id)?.children[0]).not.toHaveProperty('fillColor');
  });

  it('should change a view when its changed children are written back with updateElement', () => {
    const archimate = model();
    const view = archimate.createView('View');
    archimate.addDiagramObject(view.id, 'app-a', { x: 0, y: 0, width: 120, height: 55 });

    const child = archimate.getElement(view.id)!.child as Child[];
    child[0].lineAlpha = 64;
    archimate.updateElement(view.id, { child });

    expect(archimate.getView(view.id)?.children[0]).toMatchObject({ lineAlpha: 64 });
  });

  it('should not change the model when a nested folder from getFolders is changed', () => {
    const archimate = model();
    const folder = archimate.createFolder(archimate.getFolder('application').id, { name: 'Portals' });

    archimate.getFolders('application')[0].name = 'Changed';
    archimate.getFolders('application')[0].folders = [{ id: 'sneaky', name: 'Sneaky' }];

    expect(archimate.getFolderById(folder.id)?.name).toBe('Portals');
    expect(archimate.hasId('sneaky')).toBe(false);
  });

  it('should not change the model when a profile passed to setProfiles or returned by getProfiles is changed', () => {
    const archimate = model();
    const profile: Profile = { id: 'profile-1', name: 'Cloud', conceptType: 'ApplicationComponent' };
    archimate.setProfiles([profile]);

    profile.name = 'Changed by caller';
    archimate.getProfiles()[0].name = 'Changed from getProfiles';
    archimate.getProfile('profile-1')!.name = 'Changed from getProfile';

    expect(archimate.getProfile('profile-1')?.name).toBe('Cloud');
  });
});
