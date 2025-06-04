import type { Bounds } from "./Bounds.mjs";
import type { SourceConnection } from "./SourceConnection.mjs";


export interface Child {
  '@_xsi:type': string;
  '@_id': string;
  '@_name'?: string;
  '@_targetConnections'?: string;
  '@_fillColor'?: string;
  '@_textAlignment'?: string;
  '@_archimateElement'?: string;
  bounds: Bounds;
  documentation?: string;
  sourceConnection?: SourceConnection;
  child?: Child[];
}
