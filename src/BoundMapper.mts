import { Bounds } from './interfaces/Bounds.mjs'
import { Bounds as SchemaBounds } from "./interfaces/schema/Bounds.mjs"

export class BoundsMapper {
  static schemaBoundsToBounds(b: SchemaBounds): Bounds {
    return {
      x: Number(b['@_x']),
      y: Number(b['@_y']),
      width: Number(b['@_width']),
      height: Number(b['@_height']),
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
