import type { SourceConnection as SchemaSourceConnection } from "./interfaces/schema/SourceConnection.mjs";
import type { SourceConnection } from './interfaces/SourceConnection.mjs';
import { DiagramAttributeMapper, connectionAttributes } from './DiagramAttributeMapper.mjs';
import { toXsiType, typeFromXsiType } from './constants/archimate-mappings.mjs';

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
      type: xsiType ? typeFromXsiType(xsiType) : DEFAULT_CONNECTION_TYPE,
      ...DiagramAttributeMapper.readAttributes(b, connectionAttributes),
    };
    if (!xsiType) {
      connection.implicitType = true;
    }
    if (b.documentation !== undefined) {
      connection.documentation = String(b.documentation);
    }
    const bendpoints = DiagramAttributeMapper.schemaToBendpoints(b.bendpoint);
    if (bendpoints) connection.bendpoints = bendpoints;
    const properties = DiagramAttributeMapper.schemaToProperties(b.property);
    if (properties) connection.properties = properties;
    const features = DiagramAttributeMapper.schemaToFeatures(b.feature);
    if (features) connection.features = features;
    return connection;
  }

  public static toSchemaSourceConnection(b: SourceConnection): SchemaSourceConnection {
    const connection: SchemaSourceConnection = {
      '@_id': b.id,
      '@_source': b.source,
      '@_target': b.target,
      '@_archimateRelationship': b.archimateRelationship,
      ...DiagramAttributeMapper.writeAttributes(b, connectionAttributes),
    };
    if (b.documentation) connection.documentation = b.documentation;
    const bendpoint = DiagramAttributeMapper.bendpointsToSchema(b.bendpoints);
    if (bendpoint) connection.bendpoint = bendpoint;
    const property = DiagramAttributeMapper.propertiesToSchema(b.properties);
    if (property) connection.property = property;
    const feature = DiagramAttributeMapper.featuresToSchema(b.features);
    if (feature) connection.feature = feature;
    if (b.implicitType && b.type === DEFAULT_CONNECTION_TYPE) {
      return connection;
    }
    return { '@_xsi:type': toXsiType(b.type), ...connection };
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
