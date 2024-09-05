export interface SourceConnection {
  type: string;
  id: string;
  name?: string;
  fontColor?: string
  lineWidth?: number
  lineColor?: string
  textAlignment?: number
  textPosition?: number
  source: string;
  target: string;
  archimateRelationship: string;
  properties?: Map<string, string>;
}


