import type { ArchimateRelationshipAliasType, ArchimateRelationshipType } from '../constants/archimate-mappings.mjs';
import type { Element } from './Element.mjs';

export interface Relationship extends Element {
  type: ArchimateRelationshipType;
  source: string;
  target: string;
}

/**
 * A relationship to insert or update. `type` may be a short name ("Flow"), which is stored as the full type.
 */
export type RelationshipInput = Partial<Omit<Relationship, 'type'>> &
  Pick<Relationship, 'name' | 'source' | 'target'> & {
    type: ArchimateRelationshipType | ArchimateRelationshipAliasType;
  };
