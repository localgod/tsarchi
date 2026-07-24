import { describe, expect, it } from 'vitest';
import { listRoundtripFixtures, roundtripFixtures } from './roundtrip-utils.mjs';

describe('roundtrip fixtures', () => {
  it('should preserve every fixture after load and save', async () => {
    const fixtures = await listRoundtripFixtures();
    expect(fixtures.length).toBeGreaterThanOrEqual(4);

    const results = await roundtripFixtures();

    for (const result of results) {
      expect(result.errors, result.fixturePath).toEqual([]);
    }
  });
});
