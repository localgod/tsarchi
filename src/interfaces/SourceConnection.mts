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
  features?: Map<string, string>;
  /** Connections that start on this connection, e.g. a relationship drawn onto a relationship. */
  sourceConnection?: SourceConnection | SourceConnection[];
}
