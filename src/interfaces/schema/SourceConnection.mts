import type { Bendpoint } from "./Bendpoint.mjs";
import type { Feature } from "./Feature.mjs";
import type { Property } from "./Property.mjs";

export interface SourceConnection {
  '@_xsi:type'?: string;
  '@_id': string;
  '@_name'?: string;
  '@_source': string;
  '@_target': string;
  '@_archimateRelationship'?: string;
  '@_type'?: string;
  '@_font'?: string;
  '@_fontColor'?: string;
  '@_lineColor'?: string;
  '@_lineWidth'?: string;
  '@_textAlignment'?: string;
  '@_textPosition'?: string;
  '@_locked'?: string;
  documentation?: string;
  bendpoint?: Bendpoint | Bendpoint[];
  property?: Property | Property[];
  feature?: Feature | Feature[];
}
