import type { Bounds } from "./Bounds.mjs";
import type { SourceConnection } from "./SourceConnection.mjs";

export interface Child {
  type: string;
  id: string;
  name?: string;
  targetConnections?: string;
  archimateElement?:string;
  font?: string
  fontColor?: string
  lineWidth?: number;
  lineColor?: string
  lineAlpha?: number;
  textAlignment?: number;
  fillColor?: string
  alpha?: number;
  gradient?: number;
  textPosition?: number;
  borderType?: number;
  borderColor?: string
  iconColor?: string
  imagePath?: string
  imagePosition?: number;
  locked?: boolean;
  hintTitle?: string
  /** Alternate figure of an ArchiMate diagram object (XML attribute `type`). */
  figure?: number;
  /** Id of the view a DiagramModelReference points to. */
  model?: string;
  hintContent?: string
  content?: string
  notes?: string
  bounds: Bounds
  child?:Child[]
  sourceConnection?: SourceConnection | SourceConnection[]
  documentation?:string
  properties?: Map<string, string>;
  features?: Map<string, string>;
}
