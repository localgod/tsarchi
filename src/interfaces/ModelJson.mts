import type { FolderKey } from './Model.mjs';

/**
 * A model in tsarchi's stable JSON format, version 1, as `Archimate.toJson()` writes it and `Archimate.fromJson()`
 * reads it. `modelJsonSchema` is its JSON Schema.
 *
 * The format is lossless: a model loaded from an .archimate file and written as JSON gives the same .archimate text
 * when read back, every order in the file included. Concepts are in flat lists sorted by id, in Unicode code point
 * order, and each folder lists its members in file order. Ids are required and unique across the document.
 */
export interface ModelJson {
  formatVersion: 1;
  model: ModelRecordJson;
  /** The specializations defined on the model, in file order. */
  profiles?: ProfileJson[];
  /** The nine top-level folders, in Archi's order: strategy, business, …, relations, diagrams. */
  folders: TopLevelFolderJson[];
  /** Elements (and junctions) of every folder except relations and diagrams, sorted by id. */
  elements: ElementJson[];
  /** Relationships, sorted by id. */
  relationships: RelationshipJson[];
  /** Views, sorted by id. */
  views: ViewJson[];
  /** How the file is written: the XML declaration and the namespace prefixes, in order. */
  extensions?: { xmlDeclaration?: JsonAttribute[]; namespaces?: JsonNamespace[] };
}

/** A number; NaN and the infinities, which JSON cannot hold, are the strings `NaN`, `Infinity` and `-Infinity`. */
export type JsonNumber = number | 'NaN' | 'Infinity' | '-Infinity';

/**
 * A code Archi stores as a number, by name (for example `"left"` for `textAlignment` 1), or the number itself when
 * it has no name, such as a value a newer Archi adds.
 */
export type JsonCode<Name extends string> = Name | JsonNumber;

/** A `<property>`, `<feature>` or `<metadata>` entry. A key or value the file leaves out is left out here. */
export interface JsonEntry {
  key?: string;
  value?: string;
}

export interface JsonAttribute {
  name: string;
  value: string;
}

export interface JsonNamespace {
  prefix: string;
  uri: string;
}

/**
 * Content tsarchi does not map, as one XML element named `extensions` that carries the unrecognized attributes and
 * holds the unrecognized child elements. It is written back unchanged; its content is not part of the format.
 * Namespace prefixes in it that it does not declare itself are those of the document's `extensions.namespaces`;
 * a namespace-aware XML parser needs them declared to read it. Values are strings, as in any XML.
 */
export type JsonExtensions = string;

export interface ModelRecordJson {
  id: string;
  name?: string;
  /** Archi's model version attribute, e.g. `5.0.0`. */
  version: string;
  purpose?: string;
  properties?: JsonEntry[];
  /** An empty list is an empty `<metadata/>`. */
  metadata?: JsonEntry[];
  extensions?: JsonExtensions;
}

export interface ProfileJson {
  id: string;
  name?: string;
  conceptType?: string;
  imagePath?: string;
  specialization?: boolean;
  features?: JsonEntry[];
}

export interface FolderJson {
  id: string;
  name?: string;
  documentation?: string;
  properties?: JsonEntry[];
  features?: JsonEntry[];
  /** Ids of the elements, relationships or views placed directly in this folder, in file order. */
  members?: string[];
  /** Nested folders, in file order. */
  folders?: FolderJson[];
  extensions?: JsonExtensions;
}

export interface TopLevelFolderJson extends FolderJson {
  type: FolderKey;
}

interface ConceptJson {
  id: string;
  type: string;
  name?: string;
  documentation?: string;
  properties?: JsonEntry[];
  features?: JsonEntry[];
  extensions?: JsonExtensions;
}

export interface ElementJson extends ConceptJson {
  profiles?: string[];
  /** `or` for an OR junction. */
  junctionType?: string;
}

export interface RelationshipJson extends ConceptJson {
  profiles?: string[];
  source?: string;
  target?: string;
  accessType?: JsonCode<'write' | 'read' | 'unspecified' | 'readWrite'>;
  directed?: boolean;
  strength?: string;
}

export interface ViewJson extends ConceptJson {
  viewpoint?: string;
  background?: JsonNumber;
  connectionRouterType?: JsonCode<'manual' | 'manhattan'>;
  /** The view's diagram children, in z-order. */
  children?: DiagramChildJson[];
  /** Every connection of the view, nested ones included, in file order. Each belongs to the object it starts on. */
  connections?: ConnectionJson[];
}

export interface DiagramChildJson {
  id: string;
  /** The diagram child type, e.g. `DiagramObject`, `Group`, `Note`, `DiagramModelReference`, `SketchModelSticky`. */
  type: string;
  name?: string;
  archimateElement?: string;
  /** Id of the view a `DiagramModelReference` shows. */
  model?: string;
  bounds: { x: JsonNumber; y: JsonNumber; width: JsonNumber; height: JsonNumber };
  /** On a `DiagramObject`: Archi's box or its alternate figure. */
  figure?: JsonCode<'default' | 'alternate'>;
  textAlignment?: JsonCode<'left' | 'center' | 'right'>;
  textPosition?: JsonCode<'top' | 'center' | 'bottom'>;
  fillColor?: string;
  alpha?: JsonNumber;
  lineColor?: string;
  lineWidth?: JsonNumber;
  font?: string;
  fontColor?: string;
  /** On a `Group`: `tabbed` or `rectangle`; on a `Note`: `dogEar`, `rectangle` or `none`. */
  borderType?: JsonCode<'tabbed' | 'rectangle' | 'dogEar' | 'none'>;
  borderColor?: string;
  imagePath?: string;
  imagePosition?: JsonNumber;
  locked?: boolean;
  hintTitle?: string;
  /** Ids of the connections that end on this child, in file order. */
  targetConnections?: string[];
  documentation?: string;
  content?: string;
  notes?: string;
  hintContent?: string;
  properties?: JsonEntry[];
  /** Every `<feature>`, style settings such as `lineAlpha` and `gradient` included, in file order. */
  features?: JsonEntry[];
  /** Nested diagram children, in z-order. */
  children?: DiagramChildJson[];
  extensions?: JsonExtensions;
}

export interface ConnectionJson {
  id: string;
  type: string;
  /** True when the file leaves out xsi:type, as Archi does for plain sketch and canvas connections. */
  implicitType?: true;
  /** The diagram child or connection it starts on, which also holds it in the file. */
  source: string;
  target?: string;
  archimateRelationship?: string;
  name?: string;
  /** Archi's line style and arrow head flags of sketch and note connections. */
  lineStyle?: JsonNumber;
  font?: string;
  fontColor?: string;
  lineColor?: string;
  lineWidth?: JsonNumber;
  textAlignment?: JsonCode<'left' | 'center' | 'right'>;
  textPosition?: JsonCode<'source' | 'middle' | 'target'>;
  locked?: boolean;
  /** Ids of the connections that end on this connection, in file order. */
  targetConnections?: string[];
  documentation?: string;
  bendpoints?: { startX: JsonNumber; startY: JsonNumber; endX: JsonNumber; endY: JsonNumber }[];
  properties?: JsonEntry[];
  features?: JsonEntry[];
  extensions?: JsonExtensions;
}
