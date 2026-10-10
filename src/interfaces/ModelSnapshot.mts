import type { FolderKey } from './Model.mjs';

/**
 * A model as plain, JSON-safe data, from `Archimate.snapshot()`. `Archimate.restore()` and `Archimate.fromSnapshot()`
 * read it back.
 *
 * Unstable: the format may change in any release, and such changes are listed under **Changed** in the changelog
 * rather than treated as breaking. A snapshot is meant for use within one process and one tsarchi version (undo,
 * workers, previews, comparisons); save models as .archimate XML.
 *
 * The snapshot is canonical: two models that `toXml()` would write the same way give the same snapshot, with the
 * same key order, so `JSON.stringify` of two snapshots can be compared.
 */
export interface ModelSnapshot {
  /** The snapshot format version. `restore()` rejects a version it does not know. */
  version: 1;
  /** Attributes of the `<?xml?>` declaration, such as `version` and `encoding`. */
  xml: SnapshotEntries;
  model: {
    id: string;
    name: string;
    /** Archi's model version attribute, e.g. `5.0.0`. */
    version: string;
    /** Namespace prefixes and their URIs, in the order they are written. */
    namespaces: SnapshotEntries;
  };
  purpose?: string;
  properties?: SnapshotEntries;
  /** The model's `<metadata>` entries. An empty list is an empty `<metadata/>`. */
  metadata?: SnapshotEntries;
  profiles?: ProfileSnapshot[];
  folders: Record<FolderKey, FolderSnapshot>;
  unrecognized?: SnapshotOpaque;
}

/**
 * Key/value pairs in order, for properties, features and metadata. A key or value is null when the file leaves out
 * that attribute, as Archi does for an empty property value.
 */
export type SnapshotEntries = [key: string | null, value: string | null][];

/**
 * A number; NaN and the infinities, which JSON cannot hold, are written as the strings `NaN`, `Infinity` and `-Infinity`.
 */
export type SnapshotNumber = number | string;

/**
 * Content tsarchi does not map, in its parsed XML form. It is copied as it is.
 */
export type SnapshotOpaque = Record<string, unknown>;

export interface ProfileSnapshot {
  id?: string;
  name: string;
  conceptType?: string;
  imagePath?: string;
  specialization?: boolean;
  features?: SnapshotEntries;
}

/**
 * A top-level or nested folder, with the elements it holds directly.
 */
export interface FolderSnapshot {
  id: string;
  name: string;
  documentation?: string;
  properties?: SnapshotEntries;
  features?: SnapshotEntries;
  folders?: FolderSnapshot[];
  elements?: ElementSnapshot[];
  unrecognized?: SnapshotOpaque;
}

/**
 * An element, relationship or view.
 */
export interface ElementSnapshot {
  id?: string;
  type: string;
  name: string;
  profiles?: string;
  viewpoint?: string;
  background?: SnapshotNumber;
  connectionRouterType?: SnapshotNumber;
  source?: string;
  target?: string;
  accessType?: SnapshotNumber;
  directed?: boolean;
  strength?: string;
  junctionType?: string;
  documentation?: string;
  properties?: SnapshotEntries;
  features?: SnapshotEntries;
  /** Diagram children of a view. */
  children?: ChildSnapshot[];
  unrecognized?: SnapshotOpaque;
}

/**
 * A diagram child. Style settings stored as features (`lineAlpha`, `gradient`, …) are in `features`.
 */
export interface ChildSnapshot {
  id?: string;
  type: string;
  name?: string;
  targetConnections?: string;
  archimateElement?: string;
  textAlignment?: SnapshotNumber;
  textPosition?: SnapshotNumber;
  fillColor?: string;
  alpha?: SnapshotNumber;
  lineColor?: string;
  lineWidth?: SnapshotNumber;
  font?: string;
  fontColor?: string;
  borderType?: SnapshotNumber;
  borderColor?: string;
  imagePath?: string;
  imagePosition?: SnapshotNumber;
  locked?: boolean;
  hintTitle?: string;
  figure?: SnapshotNumber;
  model?: string;
  bounds: { x: SnapshotNumber; y: SnapshotNumber; width: SnapshotNumber; height: SnapshotNumber };
  documentation?: string;
  content?: string;
  notes?: string;
  hintContent?: string;
  properties?: SnapshotEntries;
  features?: SnapshotEntries;
  children?: ChildSnapshot[];
  connections?: ConnectionSnapshot[];
  unrecognized?: SnapshotOpaque;
}

/**
 * A view connection. Settings stored as features (`nameVisible`, `textRelativePosition`) are in `features`.
 */
export interface ConnectionSnapshot {
  id?: string;
  type: string;
  /** True when the file leaves out xsi:type, as Archi does for plain sketch and canvas connections. */
  implicitType?: true;
  source?: string;
  target?: string;
  archimateRelationship?: string;
  name?: string;
  targetConnections?: string;
  lineStyle?: SnapshotNumber;
  font?: string;
  fontColor?: string;
  lineColor?: string;
  lineWidth?: SnapshotNumber;
  textAlignment?: SnapshotNumber;
  textPosition?: SnapshotNumber;
  locked?: boolean;
  documentation?: string;
  bendpoints?: { startX: SnapshotNumber; startY: SnapshotNumber; endX: SnapshotNumber; endY: SnapshotNumber }[];
  properties?: SnapshotEntries;
  features?: SnapshotEntries;
  connections?: ConnectionSnapshot[];
  unrecognized?: SnapshotOpaque;
}
