import { Bounds } from "./Bounds.mjs";
import { ChildElement } from "./ChildElement.mjs";
import { Property } from "./Property.mjs";
import { SourceConnection } from "./SourceConnection.mjs";


export interface Element {
  property?: Array<Property> | Property;
  '@_xsi:type': string;
  '@_name': string;
  '@_id': string;
  '@_source'?: string;
  '@_target'?: string;
  '@_archimateElement'?: string;
  '@_fillColor'?: string;
  '@_targetConnections'?: string;
  child?: ChildElement;
  bounds?: Bounds;
  sourceConnection?: SourceConnection;
}
