export interface XmlMetadata {
  '@_version': string;
  '@_encoding': string;
}

export interface Property {
  '@_key': string;
  '@_value': string;
}

export interface Bounds {
  '@_x': string;
  '@_y': string;
  '@_width': string;
  '@_height': string;
}

export interface SourceConnection {
  '@_xsi:type': string;
  '@_id': string;
  '@_source': string;
  '@_target': string;
  '@_archimateRelationship': string;
}

export interface ChildElement {
  bounds: Bounds;
  child?: ChildElement[],
  '@_xsi:type': string;
  '@_id': string;
  '@_name'?: string;
  '@_targetConnections'?: string;
  '@_fillColor'?: string;
  '@_textAlignment'?: string;
  '@_archimateElement'?: string;
  sourceConnection?: SourceConnection;
}

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

export interface Folder {
  '@_name': string;
  '@_id': string;
  '@_type': string;
  element?: Array<Element> | Element;
}

export interface ArchimateModel {
  folder: Array<Folder>;
  '@_xmlns:xsi': string;
  '@_xmlns:archimate': string;
  '@_name': string;
  '@_id': string;
  '@_version': string;
}

export interface ArchimateSchema {
  '?xml': XmlMetadata;
  'archimate:model': ArchimateModel;
}
