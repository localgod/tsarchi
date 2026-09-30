import type { Folder } from "./Folder.mjs";
import type { Metadata } from "./Metadata.mjs";
import type { Profile } from "./Profile.mjs";
import type { Property } from "./Property.mjs";


export interface ModelAttributes {
  '@_xmlns:xsi': string;
  '@_xmlns:archimate': string;
  [namespace: `@_xmlns:${string}`]: string;
  '@_name': string;
  '@_id': string;
  '@_version': string;
}

export interface Model extends ModelAttributes {
  folder: Folder | Folder[];
  property?: Property | Property[];
  purpose?: string;
  /** Archi writes an empty `<metadata/>` as an empty string. */
  metadata?: Metadata | '';
  profile?: Profile | Profile[];
}
