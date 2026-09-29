import type { Feature } from './Feature.mjs';

export interface Profile {
  '@_name': string;
  '@_id': string;
  '@_imagePath'?: string;
  '@_specialization'?: string;
  '@_conceptType'?: string;
  feature?: Feature | Feature[];
}
