import { Bounds } from "./Bounds.mjs";
import { SourceConnection } from "./SourceConnection.mjs";


export interface ChildElement {
  bounds: Bounds;
  child?: ChildElement[];
  '@_xsi:type': string;
  '@_id': string;
  '@_name'?: string;
  '@_targetConnections'?: string;
  '@_fillColor'?: string;
  '@_textAlignment'?: string;
  '@_archimateElement'?: string;
  sourceConnection?: SourceConnection;
}