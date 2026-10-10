import { describe, expect, it } from 'vitest';
import { readFile } from 'fs/promises';
import { Archimate } from '../src/Archimate.mjs';

describe('bendpoints', () => {
  it('should read <bendpoint/> as a bendpoint at 0, alone or in a list', async () => {
    const model = Archimate.fromXml(await readFile('tests/fixtures/roundtrip/zero-bendpoints.archimate', 'utf8'));

    const [single, list] = model.getView('id-zb-view')!.children[0].sourceConnections;

    expect(single.bendpoints).toEqual([{ startX: 0, startY: 0, endX: 0, endY: 0 }]);
    expect(list.bendpoints).toEqual([
      { startX: 10, startY: 0, endX: 0, endY: -20 },
      { startX: 0, startY: 0, endX: 0, endY: 0 },
      { startX: 0, startY: 30, endX: 0, endY: 0 },
    ]);
  });

  it('should keep a bendpoint at 0 through save and load', async () => {
    const model = Archimate.fromXml(await readFile('tests/fixtures/roundtrip/zero-bendpoints.archimate', 'utf8'));

    const reloaded = Archimate.fromXml(model.toXml());

    expect(reloaded.getView('id-zb-view')!.children[0].sourceConnections[0].bendpoints).toEqual([
      { startX: 0, startY: 0, endX: 0, endY: 0 },
    ]);
  });
});
