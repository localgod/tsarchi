import { Bounds } from "./Bounds.mjs";
import { ChildElement } from "./ChildElement.mjs";
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
  child?: ChildElement;
  bounds?: Bounds;
  sourceConnection?: SourceConnection;
}
