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
  textAlignment?: number;
  fillColor?: string
  alpha?: number;
  textPosition?: number;
  borderType?: number;
  borderColor?: string
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
  /** Line opacity, 0–255 (feature `lineAlpha`). */
  lineAlpha?: number;
  /** Gradient direction, -1 for none (feature `gradient`). */
  gradient?: number;
  /** When the type icon is shown (feature `iconVisible`). */
  iconVisible?: number;
  /** Colour of the type icon (feature `iconColor`). */
  iconColor?: string;
  /** Whether the line colour is derived from the fill colour (feature `deriveElementLineColor`). */
  deriveElementLineColor?: boolean;
  /** Border line style (feature `lineStyle`). */
  lineStyle?: number;
  /**
   * All `<feature>` entries in file order, including the style features above. On save, those typed properties
   * take precedence over the entries of the same name here.
   */
  features?: Map<string, string>;
  /**
   * Attributes and child elements that tsarchi does not map, in their parsed XML form. They are written back
   * unchanged.
   */
  unrecognized?: Record<string, unknown>;
}
