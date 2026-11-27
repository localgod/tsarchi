import type { SourceConnection as SchemaSourceConnection } from '../interfaces/schema/SourceConnection.mjs';
import type { SourceConnection } from '../interfaces/SourceConnection.mjs';
import {
  bendpointsToSchema,
  featuresToSchema,
  readAttributes,
  readFeatures,
  readUnrecognized,
  schemaToBendpoints,
  schemaToFeatures,
  writeAttributes,
  writeFeatures,
  connectionAttributes,
  connectionFeatures,
} from './DiagramAttributeMapper.mjs';
import { toXsiType, typeFromXsiType } from '../constants/archimate-mappings.mjs';
import { toArray } from './Arrays.mjs';
import { propertiesToSchema, schemaToOptionalProperties } from './PropertyMapper.mjs';

/**
 * Archi omits xsi:type on plain connections in sketch and canvas models; Archi itself assumes this type.
 */
const DEFAULT_CONNECTION_TYPE = 'Connection';

/**
 * Keys of a `<sourceConnection>` that are mapped to `SourceConnection`.
 */
const mappedConnectionKeys = new Set([
  '@_xsi:type',
  '@_id',
  '@_source',
  '@_target',
  '@_archimateRelationship',
  ...connectionAttributes.map(([, attribute]) => `@_${attribute}`),
  'documentation',
  'bendpoint',
  'property',
  'feature',
  'sourceConnection',
]);

export function schemaToSourceConnection(b: SchemaSourceConnection): SourceConnection {
  const xsiType = b['@_xsi:type'];
  const connection: SourceConnection = {
    id: b['@_id'],
    archimateRelationship: b['@_archimateRelationship'],
    source: b['@_source'],
    target: b['@_target'],
    type: xsiType ? typeFromXsiType(xsiType) : DEFAULT_CONNECTION_TYPE,
    ...readAttributes(b, connectionAttributes),
  };
  if (!xsiType) {
    connection.implicitType = true;
  }
  if (b.documentation !== undefined) {
    connection.documentation = String(b.documentation);
  }
  const bendpoints = schemaToBendpoints(b.bendpoint);
  if (bendpoints) connection.bendpoints = bendpoints;
  const properties = schemaToOptionalProperties(b.property);
  if (properties) connection.properties = properties;
  const features = schemaToFeatures(b.feature);
  if (features) {
    Object.assign(connection, readFeatures(features, connectionFeatures));
    connection.features = features;
  }
  if (b.sourceConnection) {
    connection.sourceConnection = schemaToSourceConnections(b.sourceConnection);
  }
  const unrecognized = readUnrecognized(b, mappedConnectionKeys);
  if (unrecognized) connection.unrecognized = unrecognized;
  return connection;
}

export function toSchemaSourceConnection(b: SourceConnection): SchemaSourceConnection {
  const connection: SchemaSourceConnection = {
    '@_id': b.id,
    '@_source': b.source,
    '@_target': b.target,
    '@_archimateRelationship': b.archimateRelationship,
    ...writeAttributes(b, connectionAttributes),
  };
  if (b.documentation) connection.documentation = b.documentation;
  const bendpoint = bendpointsToSchema(b.bendpoints);
  if (bendpoint) connection.bendpoint = bendpoint;
  const property = propertiesToSchema(b.properties);
  if (property) connection.property = property;
  const feature = featuresToSchema(writeFeatures(b, b.features, connectionFeatures));
  if (feature) connection.feature = feature;
  if (b.sourceConnection) {
    connection.sourceConnection = toSchemaSourceConnections(b.sourceConnection);
  }
  Object.assign(connection, b.unrecognized);
  if (b.implicitType && b.type === DEFAULT_CONNECTION_TYPE) {
    return connection;
  }
  return { '@_xsi:type': toXsiType(b.type), ...connection };
}

export function schemaToSourceConnections(b: SchemaSourceConnection | SchemaSourceConnection[]): SourceConnection[] {
  return toArray(b).map(connection => schemaToSourceConnection(connection));
}

export function toSchemaSourceConnections(connections: SourceConnection[]): SchemaSourceConnection[] {
  return connections.map(connection => toSchemaSourceConnection(connection));
}
