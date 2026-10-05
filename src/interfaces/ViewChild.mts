import type { Child } from './Child.mjs';
import type { ViewConnection } from './View.mjs';

/**
 * A diagram child as `getView()` and `listViews()` return it: every field of the stored `Child`, with its nested
 * children, connections and target connections as arrays. It is a copy; change a view through the view methods.
 */
export interface ViewChild extends Omit<Child, 'child' | 'sourceConnection' | 'targetConnections'> {
  /** The diagram object type without namespace prefix, e.g. `DiagramObject`, `Group`, `Note`, `SketchModelSticky`. */
  type: string;
  /** Nested diagram children (`child` in the file). */
  children: ViewChild[];
  /** Connections that start on this child (`sourceConnection` in the file). */
  sourceConnections: ViewConnection[];
  /** Ids of the connections that end on this child (space-separated `targetConnections` in the file). */
  targetConnections: string[];
}
