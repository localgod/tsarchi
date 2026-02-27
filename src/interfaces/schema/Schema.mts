import type { Model } from "./Model.mjs";
import type { XmlMetadata } from "./XmlMetadata.mjs";


export interface Schema {
  '?xml': XmlMetadata;
  'archimate:model': Model;
}
