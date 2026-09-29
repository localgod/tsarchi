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
  /** View attributes */
  viewpoint?: string;
  background?: number;
  connectionRouterType?: number;
  /** AccessRelationship: 0 write (Archi's default, not written), 1 read, 2 unspecified, 3 read/write. */
  accessType?: number;
  /** Junction: 'or' for an OR junction; absent (Archi's default, not written) for AND. */
  junctionType?: string;
}
