/**
 * A user-created folder nested below one of the model's top-level folders.
 *
 * Elements stay in the top-level folder's flat `elements` list; a folder only
 * records which of them it contains, by id, so it survives element updates.
 */
export interface Folder {
  id: string;
  name: string;
  documentation?: string;
  properties?: Map<string, string>;
  /** `<feature>` entries (Archi's `IFeatures`), in file order. */
  features?: Map<string, string>;
  elementIds?: string[];
  folders?: Folder[];
  /**
   * Attributes and child elements that tsarchi does not map, in their parsed XML form. They are written back
   * unchanged.
   */
  unrecognized?: Record<string, unknown>;
}

/**
 * The details of a folder, without its elements, nested folders and unrecognised content.
 */
export type FolderDetails = Pick<Folder, 'id' | 'name' | 'documentation' | 'properties' | 'features'>;
