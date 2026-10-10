import { describe, expect, it } from 'vitest';
import { Archimate } from '../src/Archimate.mjs';
import type { Element } from '../src/interfaces/Element.mjs';
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
