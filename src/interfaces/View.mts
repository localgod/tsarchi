import type { ViewChild } from './ViewChild.mjs';

export interface View {
  id: string;
  name: string;
  type: 'ArchimateDiagramModel';
  documentation?: string;
  viewpoint?: string;
  background?: string;
  connectionRouterType?: number;
  children?: ViewChild[];
  properties?: Map<string, string>;
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
