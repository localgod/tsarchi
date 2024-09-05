import { Child } from "./Child.mjs";

export interface Element {
  id: string;
  type: string;
  name: string;
  source?: string;
  target?: string;
  child?: Child | Child[];
  properties?: Map<string, string>;
}