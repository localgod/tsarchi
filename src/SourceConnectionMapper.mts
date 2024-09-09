import { SourceConnection as SchemaSourceConnection } from "./interfaces/schema/SourceConnection.mjs";
import { SourceConnection } from './interfaces/SourceConnection.mjs';
export class SourceConnectionMapper {
  public static schemaToSourceConnection(b: SchemaSourceConnection): SourceConnection {
    return {
      id: b['@_id'],
      archimateRelationship: b['@_archimateRelationship'],
      source: b['@_source'],
      target: b['@_target'],
      type: b['@_xsi:type'].replace('archimate:', ''),
    };
  }

  public static toSchemaSourceConnection(b: SourceConnection): SchemaSourceConnection {
    return {
      '@_xsi:type': `archimate:${b.type}`,
      '@_id': b.id,
      '@_source': b.source,
      '@_target': b.target,
      '@_archimateRelationship': b.archimateRelationship,
    };
  }
}
