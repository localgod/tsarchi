import { Archimate } from '../Archimate.mjs';
import type { Schema } from '../interfaces/schema/Schema.mjs';

// Schema-level access to a model, for tsarchi's own tests and round-trip tools. Users load and save
// through Archimate.fromXml() and toXml(), which keep the schema shape out of the public API.

/**
 * Loads a model from its schema shape, as fromXml() does after reading the XML.
 */
export function archimateFromSchema(schema: Schema): Archimate {
  const archimate = new Archimate();
  archimate['parse'](schema);
  return archimate;
}

/**
 * Returns a model in its schema shape, as toXml() writes it but without validating it first.
 */
export function archimateToSchema(archimate: Archimate): Schema {
  return archimate['serialize']();
}
