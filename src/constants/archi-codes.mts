/**
 * Named values for the codes and fixed strings that Archi writes in .archimate files, so callers can pick one by name
 * instead of typing a number or string. Each object is frozen: a misspelt name is `undefined`. The values are Archi's
 * own, from `com.archimatetool.model` (the Java interface each comes from is named on it).
 */

/** The top-level folders of a model, as taken by `findElementsByFolder`, `getFolder` and the other folder methods. */
export const TopLevelFolder = Object.freeze({
  Strategy: 'strategy',
  Business: 'business',
  Application: 'application',
  Technology: 'technology',
  Motivation: 'motivation',
  ImplementationMigration: 'implementation_migration',
  Other: 'other',
  Relations: 'relations',
  Diagrams: 'diagrams',
} as const);

/** Which end of a relationship an element must be on, for `findRelationshipsForElement`. */
export const RelationshipDirection = Object.freeze({ Source: 'source', Target: 'target', Both: 'both' } as const);

/** `accessType` of an Access relationship (`IAccessRelationship`). Write is Archi's default and is not written. */
export const AccessType = Object.freeze({ Write: 0, Read: 1, Unspecified: 2, ReadWrite: 3 } as const);

/** `textAlignment` of a diagram object, group or note (`ITextAlignment`). Center is Archi's default. */
export const TextAlignment = Object.freeze({ Left: 1, Center: 2, Right: 4 } as const);

/** `figure` of an ArchiMate diagram object (`type` in the file, `IDiagramModelArchimateObject`): the box or Archi's alternate figure. Default is Archi's default and is not written. */
export const DiagramObjectFigure = Object.freeze({ Default: 0, Alternate: 1 } as const);

/** `textPosition` of a diagram object, group or note (`ITextPosition`). */
export const TextPosition = Object.freeze({ Top: 0, Center: 1, Bottom: 2 } as const);

/** `textPosition` of a view connection: where along the line its name is drawn (`IDiagramModelConnection`). */
export const ConnectionTextPosition = Object.freeze({ Source: 0, Middle: 1, Target: 2 } as const);

/** `connectionRouterType` of a view (`IDiagramModel`). Manual (bendpoints) is Archi's default. */
export const ConnectionRouterType = Object.freeze({ Manual: 0, Manhattan: 2 } as const);

/** `borderType` of a group (`IDiagramModelGroup`). Tabbed is Archi's default. */
export const GroupBorderType = Object.freeze({ Tabbed: 0, Rectangle: 1 } as const);

/** `borderType` of a note (`IDiagramModelNote`). Dog-ear is Archi's default. */
export const NoteBorderType = Object.freeze({ DogEar: 0, Rectangle: 1, None: 2 } as const);

/** The ArchiMate viewpoints Archi offers for a view (`viewpoints.xml`), as taken by `createView`. Leave the viewpoint out for none. */
export const Viewpoint = Object.freeze({
  Organization: 'organization',
  BusinessProcessCooperation: 'business_process_cooperation',
  Product: 'product',
  ApplicationCooperation: 'application_cooperation',
  ApplicationStructure: 'application_structure',
  ApplicationUsage: 'application_usage',
  ImplementationDeployment: 'implementation_deployment',
  Technology: 'technology',
  TechnologyUsage: 'technology_usage',
  InformationStructure: 'information_structure',
  ServiceRealization: 'service_realization',
  Physical: 'physical',
  Stakeholder: 'stakeholder',
  GoalRealization: 'goal_realization',
  RequirementsRealization: 'requirements_realization',
  Motivation: 'motivation',
  Strategy: 'strategy',
  Capability: 'capability',
  ValueStream: 'value_stream',
  OutcomeRealization: 'outcome_realization',
  Resource: 'resource',
  Project: 'project',
  Migration: 'migration',
  ImplementationMigration: 'implementation_migration',
  Layered: 'layered',
} as const);
