import type { Folder } from "./Folder.mjs";


export interface ModelAttributes {
  '@_xmlns:xsi': string;
  '@_xmlns:archimate': string;
  [namespace: `@_xmlns:${string}`]: string;
  '@_name': string;
  '@_id': string;
  '@_version': string;
}

export interface Model extends ModelAttributes {
  folder: Array<Folder>;
  purpose?: string;
}
