import { Folder } from "./Folder.mjs";


export interface ArchimateModel {
  folder: Array<Folder>;
  '@_xmlns:xsi': string;
  '@_xmlns:archimate': string;
  '@_name': string;
  '@_id': string;
  '@_version': string;
}
