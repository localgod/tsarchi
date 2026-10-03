
/**
 * `<bounds>` of a diagram object. Archi omits `x`/`y` when 0 and `width`/`height` when -1 (the EMF defaults).
 */
export interface Bounds {
  '@_x'?: string;
  '@_y'?: string;
  '@_width'?: string;
  '@_height'?: string;
}
