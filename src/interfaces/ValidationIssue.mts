export type ValidationIssueCode =
  | 'duplicate-id'
  | 'missing-id'
  | 'missing-name'
  | 'unknown-type'
  | 'relationship-missing-source'
  | 'relationship-missing-target'
  | 'diagram-object-missing-element'
  | 'view-connection-missing-relationship'
  | 'view-connection-missing-source'
  | 'view-connection-missing-target'
  | 'view-target-connection-missing-source';

export interface ValidationIssue {
  code: ValidationIssueCode;
  message: string;
  path: string;
  id?: string;
}

export class ArchimateValidationError extends Error {
  public readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`Archimate model validation failed with ${issues.length} issue${issues.length === 1 ? '' : 's'}.`);
    this.name = 'ArchimateValidationError';
    this.issues = issues;
  }
}
