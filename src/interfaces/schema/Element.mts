import { Bounds } from "./Bounds.mjs";
import { Child } from "./Child.mjs";
import { Property } from "./Property.mjs";
import { SourceConnection } from "./SourceConnection.mjs";


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
