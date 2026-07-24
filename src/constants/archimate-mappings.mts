// src/constants/archimate-mappings.mts

import type { FolderKey } from '../interfaces/Model.mjs';

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
  'Junction',
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
  'Diagram',
  'ArchimateDiagramModel',
] as const;

export const archimateModelTypes = [
  ...archimateStrategyElementTypes,
  ...archimateBusinessElementTypes,
  ...archimateApplicationElementTypes,
  ...archimateTechnologyElementTypes,
  ...archimateMotivationElementTypes,
  ...archimateImplementationMigrationElementTypes,
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
export type ArchimateRelationshipType = typeof archimateRelationshipTypes[number];
export type ArchimateRelationshipAliasType = typeof archimateRelationshipAliasTypes[number];
export type ArchimateViewType = typeof archimateViewTypes[number];
export type ArchimateElementType =
  | ArchimateStrategyElementType
  | ArchimateBusinessElementType
  | ArchimateApplicationElementType
  | ArchimateTechnologyElementType
  | ArchimateMotivationElementType
  | ArchimateImplementationMigrationElementType;
export type ArchimateModelType =
  | ArchimateElementType
  | ArchimateRelationshipType
  | ArchimateRelationshipAliasType
  | ArchimateViewType;

export function isArchimateModelType(type: string): type is ArchimateModelType {
  return elementTypeToFolderKey.has(type as ArchimateModelType);
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

  // Relationships
  ...archimateRelationshipTypes.map(type => [type, 'relations'] as const),
  ...archimateRelationshipAliasTypes.map(type => [type, 'relations'] as const),

  // Diagrams (Views)
  ...archimateViewTypes.map(type => [type, 'diagrams'] as const),
] satisfies ReadonlyArray<readonly [ArchimateModelType, FolderKey]>;

export const elementTypeToFolderKey: Map<ArchimateModelType, FolderKey> = new Map(elementTypeFolderEntries);
