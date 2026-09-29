import type { Element } from './Element.mjs';
import type { Feature } from './Feature.mjs';
import type { Property } from './Property.mjs';

export interface Folder {
  '@_name': string;
  '@_id': string;
  '@_type'?: string;
  documentation?: string;
  property?: Property | Property[];
  feature?: Feature | Feature[];
  folder?: Folder | Folder[];
  element?: Element | Element[];
}
