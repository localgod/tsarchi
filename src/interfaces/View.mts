import type { ViewChild } from './ViewChild.mjs';
import type { SourceConnection } from './SourceConnection.mjs';
import type { ArchimateViewType } from '../constants/archimate-mappings.mjs';

export interface View {
  id: string;
  name: string;
  type: ArchimateViewType;
  documentation?: string;
  viewpoint?: string;
  /** Sketch views: the background (integer code), as Archi writes it. */
  background?: number;
  /** Connection router: 0 manual (Archi's default, not written), 2 manhattan. */
  connectionRouterType?: number;
  /** The view's diagram children, a copy of what is stored. */
  children: ViewChild[];
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
}

export interface ViewDiagramObject extends ViewChild {
  type: 'DiagramObject';
  archimateElement: string;
}

/**
 * A view connection as `getView()` and `listViews()` return it: every field of the stored `SourceConnection`, with
 * the connections drawn onto it and its target connections as arrays.
 */
export interface ViewConnection extends Omit<SourceConnection, 'sourceConnection' | 'targetConnections'> {
  /** Connections that start on this connection, e.g. a relationship drawn onto a relationship. */
  sourceConnections: ViewConnection[];
  /** Ids of the connections that end on this connection. */
  targetConnections: string[];
}

export interface ViewBendpoint {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}
