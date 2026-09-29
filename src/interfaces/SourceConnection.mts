import type { ViewBendpoint } from "./View.mjs";

export interface SourceConnection {
  type: string;
  /** True when the source file omitted xsi:type; the attribute is then left out again on save. */
  implicitType?: boolean;
  id: string;
  name?: string;
  /** Archi's numeric `type` attribute: line style and arrow head flags of sketch and note connections. */
  lineStyle?: number
  font?: string
  fontColor?: string
  lineWidth?: number
  lineColor?: string
  textAlignment?: number
  textPosition?: number
  locked?: boolean
  source: string;
  target: string;
  archimateRelationship?: string;
  /** Space-separated ids of connections that end on this connection. */
  targetConnections?: string;
  documentation?: string;
  bendpoints?: ViewBendpoint[];
  properties?: Map<string, string>;
  /** Whether the name label is shown (feature `nameVisible`); Archi's default is `true`. */
  nameVisible?: boolean;
  /**
   * Position of the name label relative to the line (feature `textRelativePosition`), using draw2d's
   * `PositionConstants`: 1 north, 2 centre (Archi's default), 4 south, 8 west, 16 east, or a combination.
   */
  textRelativePosition?: number;
  /**
   * All `<feature>` entries in file order, including the features above. On save, those typed properties
   * take precedence over the entries of the same name here.
   */
  features?: Map<string, string>;
  /** Connections that start on this connection, e.g. a relationship drawn onto a relationship. */
  sourceConnection?: SourceConnection | SourceConnection[];
  /**
   * Attributes and child elements that tsarchi does not map, in their parsed XML form. They are written back
   * unchanged.
   */
  unrecognized?: Record<string, unknown>;
}
