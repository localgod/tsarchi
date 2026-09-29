import type { Child } from "./Child.mjs";
import type { ArchimateModelType } from "../constants/archimate-mappings.mjs";

export interface Element {
  id: string;
  type: ArchimateModelType;
  name: string;
  documentation?:string;
  source?: string;
  target?: string;
  child?: Child | Child[];
  properties?: Map<string, string>;
  /** `<feature>` entries (Archi's `IFeatures`), in file order. */
  features?: Map<string, string>;
  /** Space-separated ids of the model profiles (specializations) applied to this element or relationship. */
  profiles?: string;
  /** View attributes */
  viewpoint?: string;
  background?: number;
  connectionRouterType?: number;
  /** AccessRelationship: 0 write (Archi's default, not written), 1 read, 2 unspecified, 3 read/write. */
  accessType?: number;
  /** Junction: 'or' for an OR junction; absent (Archi's default, not written) for AND. */
  junctionType?: string;
  /**
   * Attributes and child elements that tsarchi does not map, in their parsed XML form. They are written back
   * unchanged.
   */
  unrecognized?: Record<string, unknown>;
}
