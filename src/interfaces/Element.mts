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
}
