// src/constants/archimate-mappings.mts

import type { FolderKey } from '../interfaces/Model.mjs';
import { relationshipMatrixKeys, relationshipsMatrix } from './relationships-matrix.mjs';

export const archimateStrategyElementTypes = [
  'Capability',
  'CourseOfAction',
  'Resource',
  'ValueStream',
  'Stage',
] as const;

export const archimateBusinessElementTypes = [
  'BusinessActor',
  'Actor',
  'BusinessRole',
  'BusinessCollaboration',
  'BusinessInterface',
  'BusinessProcess',
  'BusinessFunction',
  'BusinessInteraction',
  'BusinessService',
  'BusinessEvent',
  'BusinessObject',
  'Contract',
  'BusinessProduct',
  'Representation',
  'Meaning',
  'Value',
] as const;

export const archimateApplicationElementTypes = [
  'ApplicationComponent',
  'ApplicationCollaboration',
  'ApplicationInterface',
  'ApplicationProcess',
  'ApplicationFunction',
  'ApplicationInteraction',
  'ApplicationService',
  'DataObject',
] as const;

export const archimateTechnologyElementTypes = [
  'Node',
  'Device',
  'SystemSoftware',
  'TechnologyCollaboration',
  'TechnologyInterface',
  'TechnologyProcess',
  'TechnologyFunction',
  'TechnologyInteraction',
  'TechnologyService',
  'CommunicationNetwork',
  'Path',
  'Artifact',
  'TechnologyEvent',
  'TechnologyObject',
  'DistributionNetwork',
  'Facility',
  'Material',
] as const;

export const archimateMotivationElementTypes = [
  'Stakeholder',
  'Driver',
  'Assessment',
  'Goal',
  'Outcome',
  'Principle',
  'Requirement',
  'Constraint',
] as const;

export const archimateImplementationMigrationElementTypes = [
  'WorkPackage',
  'Deliverable',
  'ImplementationEvent',
  'Plateau',
  'Gap',
] as const;

export const archimateOtherElementTypes = [
  'Location',
  'Grouping',
] as const;

export const archimateConnectorTypes = [
  'Junction',
] as const;

export const archimateRelationshipTypes = [
  'AssignmentRelationship',
  'AssociationRelationship',
  'AccessRelationship',
  'CompositionRelationship',
  'AggregationRelationship',
  'FlowRelationship',
  'TriggeringRelationship',
  'ServingRelationship',
  'RealizationRelationship',
  'UsedByRelationship',
  'InfluenceRelationship',
  'SpecializationRelationship',
  'RepresentationRelationship',
  'MaterialRelationship',
] as const;

export const archimateRelationshipAliasTypes = [
  'Association',
  'Composition',
  'Aggregation',
  'Flow',
  'Triggering',
  'Serving',
  'Realization',
  'UsedBy',
  'Influence',
  'Specialization',
  'Material',
] as const;

export const archimateViewTypes = [
  'ArchimateDiagramModel',
  'SketchModel',
  'CanvasModel',
] as const;

/**
 * Diagram child types used in sketch views, in addition to the shared Group type.
 */
export const sketchModelChildTypes = [
  'SketchModelSticky',
  'SketchModelActor',
] as const;

/**
 * Types that Archi writes in the canvas namespace (xsi:type="canvas:...") rather than the archimate namespace.
 */
export const canvasModelTypes = [
  'CanvasModel',
  'CanvasModelBlock',
  'CanvasModelImage',
  'CanvasModelSticky',
  'CanvasModelConnection',
] as const;

export const archimateNamespace = 'http://www.archimatetool.com/archimate';
export const canvasNamespace = 'http://www.archimatetool.com/archimate/canvas';

/**
 * Extracts the model type from an xsi:type value. The archimate: prefix is dropped, as is canvas: on known
 * canvas types (e.g. "canvas:CanvasModelBlock" -> "CanvasModelBlock"); any other prefix is kept.
 */
export function typeFromXsiType(xsiType: string): string {
  if (xsiType.startsWith('archimate:')) {
    return xsiType.slice('archimate:'.length);
  }
  const type = xsiType.slice('canvas:'.length);
  return xsiType.startsWith('canvas:') && (canvasModelTypes as readonly string[]).includes(type) ? type : xsiType;
}

export const archimateModelTypes = [
  ...archimateStrategyElementTypes,
  ...archimateBusinessElementTypes,
  ...archimateApplicationElementTypes,
  ...archimateTechnologyElementTypes,
  ...archimateMotivationElementTypes,
  ...archimateImplementationMigrationElementTypes,
  ...archimateOtherElementTypes,
  ...archimateConnectorTypes,
  ...archimateRelationshipTypes,
  ...archimateRelationshipAliasTypes,
  ...archimateViewTypes,
] as const;

export type ArchimateStrategyElementType = typeof archimateStrategyElementTypes[number];
export type ArchimateBusinessElementType = typeof archimateBusinessElementTypes[number];
export type ArchimateApplicationElementType = typeof archimateApplicationElementTypes[number];
export type ArchimateTechnologyElementType = typeof archimateTechnologyElementTypes[number];
export type ArchimateMotivationElementType = typeof archimateMotivationElementTypes[number];
export type ArchimateImplementationMigrationElementType = typeof archimateImplementationMigrationElementTypes[number];
export type ArchimateOtherElementType = typeof archimateOtherElementTypes[number];
export type ArchimateConnectorType = typeof archimateConnectorTypes[number];
export type ArchimateRelationshipType = typeof archimateRelationshipTypes[number];
export type ArchimateRelationshipAliasType = typeof archimateRelationshipAliasTypes[number];
export type ArchimateViewType = typeof archimateViewTypes[number];
export type SketchModelChildType = typeof sketchModelChildTypes[number];
export type CanvasModelType = typeof canvasModelTypes[number];
export type ArchimateElementType =
  | ArchimateStrategyElementType
  | ArchimateBusinessElementType
  | ArchimateApplicationElementType
  | ArchimateTechnologyElementType
  | ArchimateMotivationElementType
  | ArchimateImplementationMigrationElementType
  | ArchimateOtherElementType
  | ArchimateConnectorType;
export type ArchimateModelType =
  | ArchimateElementType
  | ArchimateRelationshipType
  | ArchimateRelationshipAliasType
  | ArchimateViewType;

export function isArchimateModelType(type: string): type is ArchimateModelType {
  return elementTypeToFolderKey.has(type as ArchimateModelType);
}

export function isArchimateViewType(type: string): type is ArchimateViewType {
  return (archimateViewTypes as readonly string[]).includes(type);
}

/**
 * Maps FolderKey to a human-readable folder name.
 */
export const folderType = new Map<FolderKey, string>([
  ['strategy', 'Strategy'],
  ['business', 'Business'],
  ['application', 'Application'],
  ['technology', 'Technology & Physical'],
  ['motivation', 'Motivation'],
  ['implementation_migration', 'Implementation & Migration'],
  ['other', 'Other'],
  ['relations', 'Relations'],
  ['diagrams', 'Views'],
]);

const elementTypeFolderEntries = [
  // Strategy Layer
  ...archimateStrategyElementTypes.map(type => [type, 'strategy'] as const),

  // Business Layer
  ...archimateBusinessElementTypes.map(type => [type, 'business'] as const),

  // Application Layer
  ...archimateApplicationElementTypes.map(type => [type, 'application'] as const),

  // Technology & Physical Layer
  ...archimateTechnologyElementTypes.map(type => [type, 'technology'] as const),

  // Motivation Layer
  ...archimateMotivationElementTypes.map(type => [type, 'motivation'] as const),

  // Implementation & Migration Layer
  ...archimateImplementationMigrationElementTypes.map(type => [type, 'implementation_migration'] as const),

  // Other
  ...archimateOtherElementTypes.map(type => [type, 'other'] as const),
  ...archimateConnectorTypes.map(type => [type, 'other'] as const),

  // Relationships
  ...archimateRelationshipTypes.map(type => [type, 'relations'] as const),
  ...archimateRelationshipAliasTypes.map(type => [type, 'relations'] as const),

  // Diagrams (Views)
  ...archimateViewTypes.map(type => [type, 'diagrams'] as const),
] satisfies ReadonlyArray<readonly [ArchimateModelType, FolderKey]>;

export const elementTypeToFolderKey: Map<ArchimateModelType, FolderKey> = new Map(elementTypeFolderEntries);

/**
 * Builds an xsi:type value from a model type. Canvas types get the `canvas:` prefix, and types
 * that already carry a prefix keep it.
 */
export function toXsiType(type: string): string {
  if (type.includes(':')) return type;
  return (canvasModelTypes as readonly string[]).includes(type) ? `canvas:${type}` : `archimate:${type}`;
}

/**
 * Relationship types Archi allows from a source concept to a target concept, read from its relationships
 * matrix (see relationships-matrix.mts). A relationship used as source or target counts as "Relationship".
 * Returns null when either type is not in the matrix.
 */
export function allowedRelationshipTypes(sourceType: string, targetType: string): ArchimateRelationshipType[] | null {
  const concept = (type: string) =>
    elementTypeToFolderKey.get(type as ArchimateModelType) === 'relations' ? 'Relationship' : type;
  const targets = relationshipsMatrix[concept(sourceType)];
  if (!targets || !relationshipsMatrix[concept(targetType)]) return null;
  return [...(targets[concept(targetType)] || '')].map(key => relationshipMatrixKeys[key] as ArchimateRelationshipType);
}
