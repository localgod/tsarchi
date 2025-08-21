import type { Bounds } from './Bounds.mjs';

export interface ViewChild {
  id: string;
  type: 'Group' | 'DiagramObject' | 'Note';
  name?: string;
  bounds: Bounds;
  fillColor?: string;
  lineColor?: string;
  fontColor?: string;
  font?: string;
  lineWidth?: number;
  alpha?: number;
  textAlignment?: number;
  textPosition?: number;
  borderType?: number;
}
