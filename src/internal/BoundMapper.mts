import type { Bounds } from '../interfaces/Bounds.mjs';
import type { Bounds as SchemaBounds } from "../interfaces/schema/Bounds.mjs";

/**
 * Defaults from Archi's `archimate.ecore` (`Bounds`). EMF does not write attributes equal to their default.
 */
const defaults: Bounds = { x: 0, y: 0, width: -1, height: -1 };
const keys = ['x', 'y', 'width', 'height'] as const;

export class BoundsMapper {
  static schemaBoundsToBounds(b: SchemaBounds | '' | undefined): Bounds {
    if (b === undefined) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    const value = (key: typeof keys[number]): number => {
      // fast-xml-parser reads `<bounds/>` (every attribute at its default) as ''.
      const attribute = b === '' ? undefined : b[`@_${key}`];
      return attribute === undefined ? defaults[key] : Number(attribute) || 0;
    };
    return { x: value('x'), y: value('y'), width: value('width'), height: value('height') };
  }

  static boundsToSchemaBounds(b: Bounds): SchemaBounds {
    const schemaBounds: SchemaBounds = {};
    for (const key of keys) {
      if (b[key] !== defaults[key]) {
        schemaBounds[`@_${key}`] = String(b[key]);
      }
    }
    return schemaBounds;
  }
}
