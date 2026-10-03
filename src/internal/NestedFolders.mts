import type { Folder } from '../interfaces/Folder.mjs';

/**
 * Removes the given element ids from nested folders, at any depth.
 */
export function removeFromNestedFolders(folders: Folder[], elementIds: ReadonlySet<string>): void {
  for (const folder of folders) {
    if (folder.elementIds) {
      folder.elementIds = folder.elementIds.filter(id => !elementIds.has(id));
    }
    removeFromNestedFolders(folder.folders || [], elementIds);
  }
}
