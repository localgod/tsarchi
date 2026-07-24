import type { ArchimateRelationshipAliasType, ArchimateRelationshipType } from "../constants/archimate-mappings.mjs";
import type { Element } from "./Element.mjs";

export interface Relationship extends Element {
  type: ArchimateRelationshipType | ArchimateRelationshipAliasType;
  source: string;
  target: string;
}

export type RelationshipInput = Partial<Relationship> & Pick<Relationship, 'name' | 'type' | 'source' | 'target'>;
