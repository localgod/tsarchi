import type { Bounds } from "./Bounds.mjs";
import type { Feature } from "./Feature.mjs";
import type { Property } from "./Property.mjs";
import type { SourceConnection } from "./SourceConnection.mjs";


export interface Child {
  '@_xsi:type': string;
  '@_id': string;
  '@_name'?: string;
  '@_targetConnections'?: string;
  '@_fillColor'?: string;
  '@_textAlignment'?: string;
  '@_archimateElement'?: string;
  '@_lineColor'?: string;
  '@_lineWidth'?: string;
  '@_lineAlpha'?: string;
  '@_font'?: string;
  '@_fontColor'?: string;
  '@_alpha'?: string;
  '@_gradient'?: string;
  '@_textPosition'?: string;
  '@_borderType'?: string;
  '@_borderColor'?: string;
  '@_iconColor'?: string;
  '@_imagePath'?: string;
  '@_imagePosition'?: string;
  '@_locked'?: string;
  '@_hintTitle'?: string;
  '@_type'?: string;
  '@_model'?: string;
  bounds: Bounds;
  documentation?: string;
  content?: string;
  notes?: string;
  hintContent?: string;
  property?: Property | Property[];
  feature?: Feature | Feature[];
  sourceConnection?: SourceConnection | SourceConnection[];
  child?: Child[];
}
