import type { ViewChild } from './ViewChild.mjs';

export interface View {
  id: string;
  name: string;
  type: 'ArchimateDiagramModel' | 'SketchModel' | 'CanvasModel';
  documentation?: string;
  viewpoint?: string;
  /** Sketch views: the background (integer code), as Archi writes it. */
  background?: number;
  /** Connection router: 0 manual (Archi's default, not written), 2 manhattan. */
  connectionRouterType?: number;
  children?: ViewChild[];
  properties?: Map<string, string>;
  /** `<feature>` entries (Archi's `IFeatures`), in file order. */
  features?: Map<string, string>;
  /**
   * Attributes and child elements that tsarchi does not map, in their parsed XML form. They are written back
   * unchanged.
   */
  unrecognized?: Record<string, unknown>;
}

export interface ViewGroup extends ViewChild {
  type: 'Group';
  name?: string;
  children?: ViewChild[];
  documentation?: string;
}

export interface ViewDiagramObject extends ViewChild {
  type: 'DiagramObject';
  archimateElement: string;
  targetConnections?: string[];
  sourceConnections?: ViewConnection[];
}

export interface ViewConnection {
  id: string;
  type: 'Connection';
  source: string;
  target: string;
  archimateRelationship?: string;
  bendpoints?: ViewBendpoint[];
  lineColor?: string;
  lineWidth?: number;
  fontColor?: string;
  font?: string;
  textPosition?: number;
}

export interface ViewBendpoint {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}
