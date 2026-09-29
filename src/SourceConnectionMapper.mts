import type { SourceConnection as SchemaSourceConnection } from "./interfaces/schema/SourceConnection.mjs";
import type { SourceConnection } from './interfaces/SourceConnection.mjs';

/**
 * Archi omits xsi:type on plain connections in sketch and canvas models; Archi itself assumes this type.
 */
const DEFAULT_CONNECTION_TYPE = 'Connection';

export class SourceConnectionMapper {
  public static schemaToSourceConnection(b: SchemaSourceConnection): SourceConnection {
    const xsiType = b['@_xsi:type'];
    const connection: SourceConnection = {
      id: b['@_id'],
      archimateRelationship: b['@_archimateRelationship'],
      source: b['@_source'],
      target: b['@_target'],
      type: xsiType ? xsiType.replace(/^archimate:/, '') : DEFAULT_CONNECTION_TYPE,
    };
    if (!xsiType) {
      connection.implicitType = true;
    }
    return connection;
  }

  public static toSchemaSourceConnection(b: SourceConnection): SchemaSourceConnection {
    const connection: SchemaSourceConnection = {
      '@_id': b.id,
      '@_source': b.source,
      '@_target': b.target,
      '@_archimateRelationship': b.archimateRelationship,
    };
    if (b.implicitType && b.type === DEFAULT_CONNECTION_TYPE) {
      return connection;
    }
    return { '@_xsi:type': `archimate:${b.type}`, ...connection };
  }

  public static schemaToSourceConnections(
    b: SchemaSourceConnection | SchemaSourceConnection[],
  ): SourceConnection | SourceConnection[] {
    return Array.isArray(b)
      ? b.map((connection) => SourceConnectionMapper.schemaToSourceConnection(connection))
      : SourceConnectionMapper.schemaToSourceConnection(b);
  }

  public static toSchemaSourceConnections(
    b: SourceConnection | SourceConnection[],
  ): SchemaSourceConnection | SchemaSourceConnection[] {
    return Array.isArray(b)
      ? b.map((connection) => SourceConnectionMapper.toSchemaSourceConnection(connection))
      : SourceConnectionMapper.toSchemaSourceConnection(b);
  }
}
