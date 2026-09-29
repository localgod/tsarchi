import type { Element } from './Element.mjs';
import type { Folder } from './Folder.mjs';
import type { Profile } from './Profile.mjs';

export interface ModelFolder {
  name: string;
  id: string;
  documentation?: string;
  properties?: Map<string, string>;
  /** `<feature>` entries (Archi's `IFeatures`), in file order. */
  features?: Map<string, string>;
  /** All elements in this folder, including those placed in nested folders. */
  elements?: Element[];
  /** Nested folders, in document order. */
  folders?: Folder[];
  /**
   * Attributes and child elements that tsarchi does not map, in their parsed XML form. They are written back
   * unchanged.
   */
  unrecognized?: Record<string, unknown>;
}

export interface Model {
  strategy: ModelFolder;
  business: ModelFolder;
  application: ModelFolder;
  technology: ModelFolder;
  motivation: ModelFolder;
  implementation_migration: ModelFolder;
  other: ModelFolder;
  relations: ModelFolder;
  diagrams: ModelFolder;
}

export type FolderKey = keyof Model;

/**
 * Model-level content of `<archimate:model>` besides its folders.
 */
export interface ModelContent {
  purpose?: string;
  /** The model's `<property>` entries, in file order. */
  properties?: Map<string, string>;
  /** The `<entry>` items of the model's `<metadata>`, in file order. */
  metadata?: Map<string, string>;
  /** The specializations defined on the model, in file order. */
  profiles?: Profile[];
  /**
   * Attributes and child elements of `<archimate:model>` that tsarchi does not map, such as model `<feature>`s,
   * in their parsed XML form. They are written back unchanged.
   */
  unrecognized?: Record<string, unknown>;
}
