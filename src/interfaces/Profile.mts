/**
 * A specialization defined on the model (Archi's `<profile>`), applied to elements and relationships through
 * their `profiles` attribute.
 */
export interface Profile {
  id: string;
  name: string;
  /** The element or relationship type the specialization applies to, without namespace (e.g. `BusinessActor`). */
  conceptType?: string;
  /** Path of the specialization's image in the model's archive. */
  imagePath?: string;
  /** Archi's default is `true`, which is not written; only `false` is saved. */
  specialization?: boolean;
  /** `<feature>` entries in file order. */
  features?: Map<string, string>;
}
