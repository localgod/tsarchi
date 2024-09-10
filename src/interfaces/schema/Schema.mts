import { Model } from "./Model.mjs";
import { XmlMetadata } from "./XmlMetadata.mjs";


export interface Schema {
  '?xml': XmlMetadata;
  'archimate:model': Model;
}
