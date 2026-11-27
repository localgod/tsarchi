import { describe, expect, it } from 'vite-plus/test';
import { readFile } from 'fs/promises';
import { Archimate } from '../src/Archimate.mjs';
import type { Child } from '../src/interfaces/Child.mjs';
import type { SourceConnection } from '../src/interfaces/SourceConnection.mjs';

const fixture = 'tests/fixtures/roundtrip/connection-to-connection.archimate';

function allArrays(children: Child[]): boolean {
  const connectionsOk = (connections: SourceConnection[] | undefined): boolean =>
    connections === undefined || (Array.isArray(connections) && connections.every(c => connectionsOk(c.sourceConnection)));
  return children.every(child => connectionsOk(child.sourceConnection) && (child.child === undefined || allArrays(child.child)));
}

describe('child and sourceConnection are arrays', () => {
  it('holds a single child, connection or nested connection as a one-item array after loading', async () => {
    const model = Archimate.fromXml(await readFile(fixture, 'utf8'));
    const view = model.getElement('id-c2c-view')!;

    expect(Array.isArray(view.child)).toBe(true);
    const clerk = view.child!.find(child => child.id === 'id-clerk-object')!;
    expect(clerk.sourceConnection).toHaveLength(1);
    expect(clerk.sourceConnection![0].sourceConnection).toHaveLength(1);
    expect(allArrays(view.child!)).toBe(true);
  });

  it('holds arrays after a snapshot is restored', async () => {
    const model = Archimate.fromXml(await readFile(fixture, 'utf8'));
    const copy = Archimate.fromSnapshot(JSON.parse(JSON.stringify(model.snapshot())));

    expect(allArrays(copy.getElement('id-c2c-view')!.child!)).toBe(true);
    expect(copy.toXml()).toBe(model.toXml());
  });
});

describe('profiles and targetConnections are id arrays', () => {
  it('splits the attributes on load and joins them on save', async () => {
    const xml = await readFile(fixture, 'utf8');
    const model = Archimate.fromXml(xml);
    const cashier = model.getElement('id-c2c-view')!.child!.find(child => child.id === 'id-cashier-object')!;

    expect(cashier.targetConnections).toEqual(['id-assignment-connection']);
    expect(model.getElement('id-c2c-view')!.child![0].sourceConnection![0].targetConnections).toEqual(['id-contract-connection']);
    expect(model.toXml()).toBe(Archimate.fromXml(xml).toXml());
  });

  it('writes profiles joined by spaces and leaves out an empty list', async () => {
    const model = Archimate.fromXml(await readFile(fixture, 'utf8'));
    model.setProfiles([
      { id: 'id-p1', name: 'One', conceptType: 'BusinessActor' },
      { id: 'id-p2', name: 'Two', conceptType: 'BusinessActor' },
    ]);
    model.updateElement('id-clerk', { profiles: ['id-p1', 'id-p2'] });
    model.updateElement('id-cashier', { profiles: [] });

    const xml = model.toXml();
    expect(xml).toContain('id="id-clerk" profiles="id-p1 id-p2"');
    expect(xml).not.toMatch(/id="id-cashier" profiles=/);
    expect(Archimate.fromXml(xml).getElement('id-clerk')!.profiles).toEqual(['id-p1', 'id-p2']);
    expect(Archimate.fromSnapshot(model.snapshot()).getElement('id-clerk')!.profiles).toEqual(['id-p1', 'id-p2']);
  });
});
