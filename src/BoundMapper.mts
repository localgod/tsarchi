import type { Bounds } from './interfaces/Bounds.mjs';
import type { Bounds as SchemaBounds } from "./interfaces/schema/Bounds.mjs";

export class BoundsMapper {
  static schemaBoundsToBounds(b: SchemaBounds | undefined): Bounds {
    if (!b) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    return {
      x: Number(b['@_x']) || 0,
      y: Number(b['@_y']) || 0,
      width: Number(b['@_width']) || 0,
      height: Number(b['@_height']) || 0,
    };
  }

  static boundsToSchemaBounds(b: Bounds): SchemaBounds {
    return {
      '@_x': String(b.x),
      '@_y': String(b.y),
      '@_width': String(b.width),
      '@_height': String(b.height),
    };
  }
}
