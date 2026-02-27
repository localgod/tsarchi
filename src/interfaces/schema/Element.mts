import type { Bounds } from "./Bounds.mjs";
import type { Child } from "./Child.mjs";
import type { Property } from "./Property.mjs";
import type { SourceConnection } from "./SourceConnection.mjs";


export interface Element {
  '@_xsi:type': string;
  '@_name': string;
  '@_id': string;
  '@_source'?: string;
  '@_target'?: string;
  '@_archimateElement'?: string;
  '@_fillColor'?: string;
  '@_targetConnections'?: string;
  documentation?:string;
  property?: Array<Property> | Property;
  child?: Child | Child[];
  bounds?: Bounds;
  sourceConnection?: SourceConnection;
}
