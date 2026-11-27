import { describe, it, expect } from 'vite-plus/test';
import { boundsToSchema, schemaToBounds } from '../src/internal/BoundMapper.mjs';
import type { Bounds as SchemaBounds } from '../src/interfaces/schema/Bounds.mjs';

describe('BoundsMapper', () => {
  it('should convert valid schema bounds to bounds', () => {
    const schemaBounds: SchemaBounds = {
      '@_x': '10',
      '@_y': '20',
      '@_width': '100',
      '@_height': '50',
    };

    const result = schemaToBounds(schemaBounds);

    expect(result).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('should handle undefined bounds gracefully', () => {
    const result = schemaToBounds(undefined);

    expect(result).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('should handle invalid numeric values in bounds', () => {
    const schemaBounds: SchemaBounds = {
      '@_x': 'invalid',
      '@_y': '',
      '@_width': '100',
      '@_height': 'NaN',
    };

    const result = schemaToBounds(schemaBounds);

    expect(result).toEqual({ x: 0, y: 0, width: 100, height: 0 });
  });

  it('should convert bounds to schema bounds', () => {
    const bounds = { x: 15, y: 25, width: 200, height: 75 };

    const result = boundsToSchema(bounds);

    expect(result).toEqual({
      '@_x': '15',
      '@_y': '25',
      '@_width': '200',
      '@_height': '75',
    });
  });

  it('should read missing attributes as the Archi defaults', () => {
    expect(schemaToBounds({ '@_width': '193', '@_height': '85' })).toEqual({ x: 0, y: 0, width: 193, height: 85 });
    expect(schemaToBounds({ '@_x': '240', '@_y': '12' })).toEqual({ x: 240, y: 12, width: -1, height: -1 });
    expect(schemaToBounds('')).toEqual({ x: 0, y: 0, width: -1, height: -1 });
  });

  it('should omit attributes equal to the Archi defaults', () => {
    expect(boundsToSchema({ x: 0, y: 0, width: 193, height: 85 })).toEqual({ '@_width': '193', '@_height': '85' });
    expect(boundsToSchema({ x: 240, y: 12, width: -1, height: -1 })).toEqual({ '@_x': '240', '@_y': '12' });
    expect(boundsToSchema({ x: 0, y: 0, width: -1, height: -1 })).toEqual({});
  });
});
