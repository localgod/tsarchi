import type { Bounds } from './Bounds.mjs';
import type { Child } from './Child.mjs';
import type { Feature } from './Feature.mjs';
import type { Property } from './Property.mjs';
import type { SourceConnection } from './SourceConnection.mjs';

export interface Element {
  '@_xsi:type'?: string;
  '@_name'?: string;
  '@_id': string;
  /** Space-separated ids of the profiles (specializations) applied to this concept. */
  '@_profiles'?: string;
  '@_source'?: string;
  '@_target'?: string;
  '@_archimateElement'?: string;
  '@_fillColor'?: string;
  '@_targetConnections'?: string;
  '@_viewpoint'?: string;
  '@_background'?: string;
  '@_connectionRouterType'?: string;
  '@_accessType'?: string;
  /** Junction type ('or'); only on Junction elements. */
  '@_type'?: string;
  documentation?: string;
  property?: Array<Property> | Property;
  feature?: Feature | Feature[];
  child?: Child | Child[];
  bounds?: Bounds;
  sourceConnection?: SourceConnection | SourceConnection[];
}
