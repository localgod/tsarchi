import type { Element } from '../interfaces/Element.mjs';
import type { Child } from '../interfaces/Child.mjs';
import type { SourceConnection } from '../interfaces/SourceConnection.mjs';
import { toArray } from './Arrays.mjs';
import { splitIds } from './ViewChildMapper.mjs';

/**
 * The connections starting on a child, and every connection nested in them.
 */
export function allSourceConnections(child: Child): SourceConnection[] {
  return flattenConnections(toArray(child.sourceConnection));
}

/**
 * The connections and every connection nested in them.
 */
export function flattenConnections(connections: SourceConnection[]): SourceConnection[] {
  return connections.flatMap(connection => {
    const nested = connection.sourceConnection;
    if (!nested) return [connection];
    return [connection, ...flattenConnections(toArray(nested))];
  });
}

/**
 * Removes the matching children at any depth of a view, with their contents, connections from or to anything
 * removed, and every targetConnections reference to a removed connection. Returns the ids of everything removed.
 */
export function removeViewChildren(viewElement: Element, shouldRemove: (child: Child) => boolean): Set<string> {
  const removedIds = new Set<string>();
  if (!viewElement.child) return removedIds;

  const keptChildren = removeMatchingChildren(toArray(viewElement.child), shouldRemove, removedIds);
  if (removedIds.size === 0) return removedIds;

  viewElement.child = keptChildren;
  // Connections from other objects to a removed child go with it, as do connections attached to those.
  while (removeConnectionsFromChildren(keptChildren, () => false, removedIds));
  removeTargetConnectionReferences(keptChildren, removedIds);
  return removedIds;
}

/**
 * Removes the matching connections of a view, connections nested in them, connections attached to a removed
 * connection, and every targetConnections reference to a removed connection. Returns the ids of the removed connections.
 */
export function removeViewConnections(viewElement: Element, shouldRemove: (connection: SourceConnection) => boolean): Set<string> {
  const removedIds = new Set<string>();
  if (!viewElement.child) return removedIds;

  const children = toArray(viewElement.child);
  // A connection can be attached to a removed connection that was visited earlier or later.
  while (removeConnectionsFromChildren(children, shouldRemove, removedIds));
  if (removedIds.size > 0) removeTargetConnectionReferences(children, removedIds);
  return removedIds;
}

/**
 * Removes matching children at any depth, collecting the ids of the removed children, their contents and their connections.
 */
function removeMatchingChildren(children: Child[], shouldRemove: (child: Child) => boolean, removedIds: Set<string>): Child[] {
  const keptChildren: Child[] = [];

  for (const child of children) {
    if (shouldRemove(child)) {
      collectSubtreeIds(child, removedIds);
      continue;
    }

    const nested = child.child ?? [];
    if (nested.length > 0) {
      const keptNested = removeMatchingChildren(nested, shouldRemove, removedIds);
      if (keptNested.length === 0) {
        delete child.child;
      } else if (keptNested.length !== nested.length) {
        child.child = keptNested;
      }
    }

    keptChildren.push(child);
  }

  return keptChildren;
}

function collectSubtreeIds(child: Child, ids: Set<string>): void {
  ids.add(child.id);
  for (const connection of allSourceConnections(child)) {
    ids.add(connection.id);
  }
  for (const nested of child.child ?? []) {
    collectSubtreeIds(nested, ids);
  }
}

/**
 * Returns true when a connection was removed.
 */
function removeConnectionsFromChildren(
  children: Child[],
  shouldRemove: (connection: SourceConnection) => boolean,
  removedIds: Set<string>
): boolean {
  let removedAny = false;

  for (const child of children) {
    if (removeOwnedConnections(child, shouldRemove, removedIds)) removedAny = true;
    if (removeConnectionsFromChildren(child.child ?? [], shouldRemove, removedIds)) removedAny = true;
  }

  return removedAny;
}

/**
 * Filters the connections starting on a child or connection, keeping the single-object or array shape of
 * `sourceConnection`.
 */
function removeOwnedConnections(
  owner: { sourceConnection?: SourceConnection | SourceConnection[] },
  shouldRemove: (connection: SourceConnection) => boolean,
  removedIds: Set<string>
): boolean {
  const sourceConnection = owner.sourceConnection;
  if (!sourceConnection) return false;

  const connections = toArray(sourceConnection);
  let removedAny = false;
  for (const connection of connections) {
    if (removeOwnedConnections(connection, shouldRemove, removedIds)) removedAny = true;
  }

  const kept = connections.filter(connection => {
    const remove = shouldRemove(connection) || removedIds.has(connection.source) || removedIds.has(connection.target);
    if (remove) {
      // Connections nested in a removed connection go with it.
      for (const removed of flattenConnections([connection])) {
        removedIds.add(removed.id);
      }
    }
    return !remove;
  });
  if (kept.length === connections.length) return removedAny;

  if (kept.length === 0) {
    delete owner.sourceConnection;
  } else {
    owner.sourceConnection = Array.isArray(sourceConnection) ? kept : kept[0];
  }
  return true;
}

function removeTargetConnectionReferences(children: Child[], connectionIds: Set<string>): void {
  for (const child of children) {
    removeTargetConnectionReference(child, connectionIds);
    for (const connection of allSourceConnections(child)) {
      removeTargetConnectionReference(connection, connectionIds);
    }
    removeTargetConnectionReferences(child.child ?? [], connectionIds);
  }
}

function removeTargetConnectionReference(owner: { targetConnections?: string }, connectionIds: Set<string>): void {
  const ids = splitIds(owner.targetConnections);
  const kept = ids.filter(id => !connectionIds.has(id));
  if (kept.length === ids.length) return;
  if (kept.length === 0) {
    delete owner.targetConnections;
  } else {
    owner.targetConnections = kept.join(' ');
  }
}
