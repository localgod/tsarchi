import type { Child } from '../interfaces/Child.mjs';
import type { SourceConnection } from '../interfaces/SourceConnection.mjs';
import type { ViewChild } from '../interfaces/ViewChild.mjs';
import type { ViewConnection } from '../interfaces/View.mjs';
import { deepCopy } from './Copy.mjs';

/**
 * Copies the values a caller could change in place, so a returned view does not share them with the model.
 */
function copyValues<T extends object>(source: T): T {
  const copy = { ...source } as Record<string, unknown>;
  for (const [key, value] of Object.entries(copy)) {
    if (value instanceof Map) copy[key] = new Map(value);
    else if (key === 'bounds' && value) copy[key] = { ...value };
    else if (key === 'bendpoints' && Array.isArray(value)) copy[key] = value.map(bendpoint => ({ ...bendpoint }));
    else if (key === 'properties' && Array.isArray(value)) copy[key] = value.map(property => ({ ...property }));
    else if (key === 'unrecognized' && value) copy[key] = deepCopy(value);
  }
  return copy as T;
}

/**
 * Converts a stored diagram child to the shape `getView()` returns, as a copy.
 */
export function toViewChild(child: Child): ViewChild {
  const { child: children, sourceConnection, targetConnections, ...rest } = child;
  return {
    ...copyValues(rest),
    children: (children ?? []).map(toViewChild),
    sourceConnections: (sourceConnection ?? []).map(toViewConnection),
    targetConnections: [...(targetConnections ?? [])],
  };
}

/**
 * Converts a stored view connection to the shape `getView()` returns, as a copy.
 */
export function toViewConnection(connection: SourceConnection): ViewConnection {
  const { sourceConnection, targetConnections, ...rest } = connection;
  return {
    ...copyValues(rest),
    sourceConnections: (sourceConnection ?? []).map(toViewConnection),
    targetConnections: [...(targetConnections ?? [])],
  };
}
