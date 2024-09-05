import { Bounds } from "./Bounds.mjs";
import { SourceConnection } from "./SourceConnection.mjs";

export interface Child {
  type: string;
  id: string;
  name?: string;
  targetConnections?: string;
  archimateElement?:string;
  fontColor?: string
  lineWidth?: number;
  textAlignment?: number;
  fillColor?: string
  alpha?: number;
  textPosition?: number;
  borderType?: number;
  bounds: Bounds
  child?:Child[]
  sourceConnection?:SourceConnection
}
