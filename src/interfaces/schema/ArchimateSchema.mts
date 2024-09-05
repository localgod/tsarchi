import { ArchimateModel } from "./ArchimateModel.mjs";
import { XmlMetadata } from "./XmlMetadata.mjs";


export interface ArchimateSchema {
  '?xml': XmlMetadata;
  'archimate:model': ArchimateModel;
}
