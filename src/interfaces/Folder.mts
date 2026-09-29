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
  elementIds?: string[];
  folders?: Folder[];
}
