export type ValidationIssueCode =
  | 'duplicate-id'
  | 'missing-id'
  | 'missing-name'
  | 'unknown-type'
  | 'relationship-missing-source'
  | 'relationship-missing-target'
  | 'relationship-endpoint-not-allowed'
  | 'relationship-type-not-allowed'
  | 'junction-relationship-type-mismatch'
  | 'diagram-object-missing-element'
  | 'diagram-reference-missing-view'
  | 'element-missing-profile'
  | 'view-connection-missing-relationship'
  | 'view-connection-missing-source'
  | 'view-connection-missing-target'
  | 'view-target-connection-missing-source';

/**
 * `error`: the model is inconsistent (dangling references, duplicate ids) and is not saved.
 * `warning`: the model is saved, but it breaks a convention or an ArchiMate rule, or has types tsarchi does not know.
 */
export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  code: ValidationIssueCode;
  severity: ValidationSeverity;
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
