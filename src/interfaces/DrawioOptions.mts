/**
 * Options for `Archimate.toDrawio()`.
 */
export interface DrawioOptions {
  /**
   * Draw ArchiMate elements with draw.io's ArchiMate 3 shapes (`mxgraph.archimate3.*`) instead of plain rectangles.
   * Defaults to `false`. Relationships are drawn with their ArchiMate line and arrow styles either way.
   */
  stencils?: boolean;
}
