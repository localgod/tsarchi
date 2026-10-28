import type { Element } from '../interfaces/Element.mjs';
import type { Child } from '../interfaces/Child.mjs';
import type { SourceConnection } from '../interfaces/SourceConnection.mjs';
import { toArray } from './Arrays.mjs';
import { deepCopy } from './Copy.mjs';
import { splitIds } from './ViewChildMapper.mjs';

/**
 * A copy of a view with new ids for the view and everything in it, as Archi's Duplicate does: connection ends and
 * `targetConnections` point to the copied objects, a view reference to the view itself points to the copy, and ids in
 * `unrecognized` content are rewritten the same way. Elements, relationships and other views are still referred to.
 */
export function copyView(view: Element, newId: () => string): Element {
  const copy = deepCopy(view);
  const ids = new Map<string, string>([[view.id, newId()]]);

  const collect = (owner: { id: string; unrecognized?: Record<string, unknown> }): void => {
    ids.set(owner.id, newId());
    collectUnrecognizedIds(owner.unrecognized, ids, newId);
  };
  collectUnrecognizedIds(copy.unrecognized, ids, newId);
  forEachObject(toArray(copy.child), collect, collect);

  copy.id = ids.get(view.id)!;
  rewriteUnrecognized(copy.unrecognized, ids);
  forEachObject(
    toArray(copy.child),
    child => {
      rewriteIds(child, ids);
      if (child.model === view.id) child.model = copy.id;
    },
    connection => {
      rewriteIds(connection, ids);
      connection.source = ids.get(connection.source) ?? connection.source;
      connection.target = ids.get(connection.target) ?? connection.target;
    }
  );
  return copy;
}

/**
 * Calls the callbacks for every child at any depth and every connection starting on one, nested connections included.
 */
function forEachObject(children: Child[], onChild: (child: Child) => void, onConnection: (connection: SourceConnection) => void): void {
  const visitConnections = (connections: SourceConnection[]): void => {
    for (const connection of connections) {
      onConnection(connection);
      visitConnections(toArray(connection.sourceConnection));
    }
  };
  for (const child of children) {
    onChild(child);
    visitConnections(toArray(child.sourceConnection));
    forEachObject(toArray(child.child), onChild, onConnection);
  }
}

function rewriteIds(
  owner: { id: string; targetConnections?: string; unrecognized?: Record<string, unknown> },
  ids: Map<string, string>
): void {
  owner.id = ids.get(owner.id) ?? owner.id;
  if (owner.targetConnections !== undefined) owner.targetConnections = rewriteIdList(owner.targetConnections, ids);
  rewriteUnrecognized(owner.unrecognized, ids);
}

function rewriteIdList(value: string, ids: Map<string, string>): string {
  return splitIds(value)
    .map(id => ids.get(id) ?? id)
    .join(' ');
}

/**
 * Gives a new id to every element with an `@_id` in unrecognized content, at any depth.
 */
function collectUnrecognizedIds(node: unknown, ids: Map<string, string>, newId: () => string): void {
  if (Array.isArray(node)) {
    for (const item of node) collectUnrecognizedIds(item, ids, newId);
  } else if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (typeof record['@_id'] === 'string') ids.set(record['@_id'], newId());
    for (const value of Object.values(record)) collectUnrecognizedIds(value, ids, newId);
  }
}

/**
 * Rewrites `@_id`, `@_source`, `@_target` and `@_targetConnections` in unrecognized content to the new ids.
 */
function rewriteUnrecognized(node: unknown, ids: Map<string, string>): void {
  if (Array.isArray(node)) {
    for (const item of node) rewriteUnrecognized(item, ids);
  } else if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    for (const key of ['@_id', '@_source', '@_target']) {
      const value = record[key];
      if (typeof value === 'string' && ids.has(value)) record[key] = ids.get(value);
    }
    const targetConnections = record['@_targetConnections'];
    if (typeof targetConnections === 'string') record['@_targetConnections'] = rewriteIdList(targetConnections, ids);
    for (const value of Object.values(record)) rewriteUnrecognized(value, ids);
  }
}
