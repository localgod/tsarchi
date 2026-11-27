import type { Child } from '../interfaces/Child.mjs';
import type { Element } from '../interfaces/Element.mjs';
import type { Folder } from '../interfaces/Folder.mjs';
import type { FolderKey, Model } from '../interfaces/Model.mjs';
import type { Profile } from '../interfaces/Profile.mjs';
import type { Relationship } from '../interfaces/Relationship.mjs';
import { allSourceConnections } from './ViewRemoval.mjs';

/**
 * An element, relationship or view and the top-level folder that stores it.
 */
export interface ElementEntry {
  folderKey: FolderKey;
  element: Element;
}

/**
 * Lookups over a model by id, each built from the model when first needed, so that inserts and lookups do not walk
 * the whole model every time.
 *
 * Code that changes the model keeps the index current: it reports what it adds, replaces or removes, and calls
 * `clear()` after any other change to ids, elements, relationships or views.
 */
export class ModelIndex {
  /**
   * How often each id is used: profiles, folders, elements, relationships, views, diagram children and view
   * connections. A count, not a set, so an id used twice in an invalid model stays known when one use is removed.
   */
  private ids: Map<string, number> | undefined;
  /** The first element, relationship or view with each id, in folder order. */
  private elements: Map<string, ElementEntry> | undefined;
  /** Ids that more than one element, relationship or view has, as an invalid file can; built with `elements`. */
  private duplicateElementIds = new Set<string>();
  /** The relationships with each id as source or target, once each, in folder order. */
  private relationships: Map<string, Relationship[]> | undefined;

  constructor(
    private readonly model: () => Model,
    private readonly profiles: () => Profile[] | undefined = () => undefined
  ) {}

  hasId(id: string): boolean {
    if (!this.ids) {
      this.ids = new Map();
      for (const modelId of this.modelIds()) this.ids.set(modelId, (this.ids.get(modelId) ?? 0) + 1);
    }
    return this.ids.has(id);
  }

  element(id: string): ElementEntry | undefined {
    if (!this.elements) {
      this.elements = new Map();
      this.duplicateElementIds = new Set();
      for (const folderKey of Object.keys(this.model()) as FolderKey[]) {
        for (const element of this.model()[folderKey].elements || []) {
          if (!this.elements.has(element.id)) this.elements.set(element.id, { folderKey, element });
          else this.duplicateElementIds.add(element.id);
        }
      }
    }
    return this.elements.get(id);
  }

  /**
   * The stored relationships with the id as source or target, in folder order.
   */
  relationshipsOf(id: string): Relationship[] {
    this.relationships ??= relationshipsByEndpoint((this.model().relations.elements || []) as Relationship[]);
    return this.relationships.get(id) ?? [];
  }

  /**
   * Records an id added anywhere in the model, such as a diagram child, view connection or folder.
   */
  addId(id: string): void {
    if (this.ids) this.ids.set(id, (this.ids.get(id) ?? 0) + 1);
  }

  /**
   * Records ids removed anywhere in the model, such as diagram children and view connections, one use each.
   */
  removeIds(ids: Iterable<string>): void {
    if (!this.ids) return;
    for (const id of ids) {
      const count = this.ids.get(id);
      if (count === undefined) continue;
      if (count > 1) this.ids.set(id, count - 1);
      else this.ids.delete(id);
    }
  }

  /**
   * Records an element, relationship or view just added at the end of a top-level folder.
   */
  added(folderKey: FolderKey, element: Element): void {
    this.addId(element.id);
    for (const id of viewChildIds(element.child ?? [])) this.addId(id);
    if (this.elements) {
      if (!this.elements.has(element.id)) this.elements.set(element.id, { folderKey, element });
      else this.duplicateElementIds.add(element.id);
    }
    if (folderKey === 'relations' && this.relationships) addByEndpoint(this.relationships, element as Relationship);
  }

  /**
   * Records that an element, relationship or view, with the same id and diagram children, is now stored as this object
   * and in this folder, or that its fields changed in place.
   */
  replaced(previousFolderKey: FolderKey, folderKey: FolderKey, element: Element): void {
    if (this.elements?.get(element.id)?.folderKey === previousFolderKey) this.elements.set(element.id, { folderKey, element });
    if (previousFolderKey === 'relations' || folderKey === 'relations') this.relationships = undefined;
  }

  /**
   * Records elements, relationships or views removed from their top-level folders, and the ids of the diagram children
   * and view connections removed with them (including those of a removed view).
   */
  removed(elements: Iterable<Element>, viewObjectIds: Iterable<string> = []): void {
    const removedRelationships = new Set<Element>();
    for (const element of elements) {
      this.removeIds([element.id]);
      if (this.elements?.get(element.id)?.element === element) {
        // Another element with the same id (an invalid model) takes its place when the lookup is built again.
        if (this.duplicateElementIds.has(element.id)) this.elements = undefined;
        else this.elements.delete(element.id);
      }
      if (element.source !== undefined || element.target !== undefined) removedRelationships.add(element);
    }
    this.removeIds(viewObjectIds);
    if (this.relationships && removedRelationships.size > 0) {
      for (const relationship of removedRelationships as Set<Relationship>) {
        for (const endpoint of [relationship.source, relationship.target]) {
          const attached = this.relationships.get(endpoint)?.filter(other => !removedRelationships.has(other));
          if (attached === undefined) continue;
          if (attached.length > 0) this.relationships.set(endpoint, attached);
          else this.relationships.delete(endpoint);
        }
      }
    }
  }

  /**
   * Makes every lookup read the model again, after a change that removed or replaced ids, elements or relationships.
   */
  clear(): void {
    this.ids = undefined;
    this.elements = undefined;
    this.relationships = undefined;
  }

  private *modelIds(): Generator<string> {
    for (const profile of this.profiles() ?? []) yield profile.id;
    for (const folder of Object.values(this.model())) {
      yield folder.id;
      yield* folderIds(folder.folders || []);
      for (const element of folder.elements || []) {
        yield element.id;
        yield* viewChildIds(element.child ?? []);
      }
    }
  }
}

function* folderIds(folders: Folder[]): Generator<string> {
  for (const folder of folders) {
    yield folder.id;
    yield* folderIds(folder.folders || []);
  }
}

/**
 * The ids of the diagram children at any depth and of the view connections starting on them.
 */
export function* viewChildIds(children: Child[]): Generator<string> {
  for (const child of children) {
    yield child.id;
    for (const connection of allSourceConnections(child)) yield connection.id;
    yield* viewChildIds(child.child ?? []);
  }
}

function addByEndpoint(byEndpoint: Map<string, Relationship[]>, relationship: Relationship): void {
  const add = (endpoint: string) => {
    const attached = byEndpoint.get(endpoint);
    if (attached) attached.push(relationship);
    else byEndpoint.set(endpoint, [relationship]);
  };
  if (relationship.source) add(relationship.source);
  if (relationship.target && relationship.target !== relationship.source) add(relationship.target);
}

/**
 * The relationships with each id as source or target, once each, in the order given.
 */
export function relationshipsByEndpoint(relationships: Relationship[]): Map<string, Relationship[]> {
  const byEndpoint = new Map<string, Relationship[]>();
  for (const relationship of relationships) addByEndpoint(byEndpoint, relationship);
  return byEndpoint;
}
