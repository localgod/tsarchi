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
