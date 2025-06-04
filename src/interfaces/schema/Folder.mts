import type { Element } from './Element.mjs';
export interface Folder {
  '@_name': string;
  '@_id': string;
  '@_type': string;
  element?: Element | Element[];
}
