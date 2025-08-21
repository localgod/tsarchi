import { describe, it, expect } from 'vitest';
import { BoundsMapper } from '../src/BoundMapper.mjs';
import type { Bounds as SchemaBounds } from '../src/interfaces/schema/Bounds.mjs';

describe('BoundsMapper', () => {
  it('should convert valid schema bounds to bounds', () => {
    const schemaBounds: SchemaBounds = {
      '@_x': '10',
      '@_y': '20',
      '@_width': '100',
      '@_height': '50'
    };

    const result = BoundsMapper.schemaBoundsToBounds(schemaBounds);

    expect(result).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50
    });
  });

  it('should handle undefined bounds gracefully', () => {
    const result = BoundsMapper.schemaBoundsToBounds(undefined);

    expect(result).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0
    });
  });

  it('should handle invalid numeric values in bounds', () => {
    const schemaBounds: SchemaBounds = {
      '@_x': 'invalid',
      '@_y': '',
      '@_width': '100',
      '@_height': 'NaN'
    };

    const result = BoundsMapper.schemaBoundsToBounds(schemaBounds);

    expect(result).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 0
    });
  });

  it('should convert bounds to schema bounds', () => {
    const bounds = {
      x: 15,
      y: 25,
      width: 200,
      height: 75
    };

    const result = BoundsMapper.boundsToSchemaBounds(bounds);

    expect(result).toEqual({
      '@_x': '15',
      '@_y': '25',
      '@_width': '200',
      '@_height': '75'
    });
  });
});
