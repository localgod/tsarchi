/**
 * Why a text could not be loaded as an Archi model.
 * `not-xml`: the text is not well-formed XML.
 * `not-archimate`: the XML has no `<archimate:model>` root element.
 * `invalid-structure`: the root is `<archimate:model>`, but its content could not be read as a model.
 */
export type ArchimateParseErrorKind = 'not-xml' | 'not-archimate' | 'invalid-structure';

export interface ArchimateParseErrorDetails {
  /** 1-based line of the XML error, for `not-xml`. */
  line?: number;
  /** 1-based column of the XML error, for `not-xml`. */
  column?: number;
  /** The underlying error, for `invalid-structure`. */
  cause?: unknown;
}

export class ArchimateParseError extends Error {
  public readonly kind: ArchimateParseErrorKind;
  public readonly line?: number;
  public readonly column?: number;
  public readonly cause?: unknown;

  constructor(kind: ArchimateParseErrorKind, message: string, details: ArchimateParseErrorDetails = {}) {
    super(message);
    this.name = 'ArchimateParseError';
    this.kind = kind;
    this.line = details.line;
    this.column = details.column;
    this.cause = details.cause;
  }
}
