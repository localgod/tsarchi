export interface SourceConnection {
  type: string;
  /** True when the source file omitted xsi:type; the attribute is then left out again on save. */
  implicitType?: boolean;
  id: string;
  name?: string;
  fontColor?: string
  lineWidth?: number
  lineColor?: string
  textAlignment?: number
  textPosition?: number
  source: string;
  target: string;
  archimateRelationship?: string;
  properties?: Map<string, string>;
}


