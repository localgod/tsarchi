/**
 * One `<property>` of a model, folder, element, relationship, view, diagram child or view connection. Archi keeps
 * properties as an ordered list in which a key may appear more than once; `getProperty`, `setProperty` and the other
 * property helpers read and change such a list.
 */
export interface Property {
  /** Left out when the file has no `key` attribute, as Archi does for an empty key. */
  key?: string;
  /** Left out when the file has no `value` attribute, as Archi does for an empty value. */
  value?: string;
}
