import type { Element } from './Element.mjs';
import type { Folder } from './Folder.mjs';

export interface ModelFolder {
  name: string;
  id: string;
  documentation?: string;
  properties?: Map<string, string>;
  /** All elements in this folder, including those placed in nested folders. */
  elements?: Element[];
  /** Nested folders, in document order. */
  folders?: Folder[];
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
