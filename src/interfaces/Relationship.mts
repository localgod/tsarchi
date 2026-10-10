import type { ArchimateRelationshipType } from '../constants/archimate-mappings.mjs';
import type { Element } from './Element.mjs';

export interface Relationship extends Element {
  type: ArchimateRelationshipType;
  source: string;
  target: string;
}

/**
 * A relationship to insert or update.
 */
export type RelationshipInput = Partial<Relationship> & Pick<Relationship, 'name' | 'type' | 'source' | 'target'>;
