import type { Child } from '../interfaces/Child.mjs';
import type { Element } from '../interfaces/Element.mjs';
import type { Folder } from '../interfaces/Folder.mjs';
import type { FolderKey, Model } from '../interfaces/Model.mjs';
import type { Profile } from '../interfaces/Profile.mjs';
import type { Relationship } from '../interfaces/Relationship.mjs';
import { toArray } from './Arrays.mjs';

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
 * Code that changes the model keeps the index current: it reports what it adds or replaces, and calls `clear()`
 * after any other change to ids, elements, relationships or views.
 */
export class ModelIndex {
  /** Every id in use: profiles, folders, elements, relationships, views, diagram children and view connections. */
  private ids: Set<string> | undefined;
  /** The first element, relationship or view with each id, in folder order. */
  private elements: Map<string, ElementEntry> | undefined;
  /** The relationships with each id as source or target, once each, in folder order. */
  private relationships: Map<string, Relationship[]> | undefined;

  constructor(
    private readonly model: () => Model,
    private readonly profiles: () => Profile[] | undefined = () => undefined
  ) {}

  hasId(id: string): boolean {
    this.ids ??= new Set(this.modelIds());
    return this.ids.has(id);
  }

  element(id: string): ElementEntry | undefined {
    if (!this.elements) {
      this.elements = new Map();
      for (const folderKey of Object.keys(this.model()) as FolderKey[]) {
        for (const element of this.model()[folderKey].elements || []) {
          if (!this.elements.has(element.id)) this.elements.set(element.id, { folderKey, element });
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
    this.ids?.add(id);
  }

  /**
   * Records an element, relationship or view just added at the end of a top-level folder.
   */
  added(folderKey: FolderKey, element: Element): void {
    if (toArray(element.child).length > 0) {
      this.clear();
      return;
    }
    this.addId(element.id);
    if (this.elements && !this.elements.has(element.id)) this.elements.set(element.id, { folderKey, element });
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
        yield* viewChildIds(toArray(element.child));
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

function* viewChildIds(children: Child[]): Generator<string> {
  for (const child of children) {
    yield child.id;
    for (const connection of toArray(child.sourceConnection)) yield connection.id;
    yield* viewChildIds(toArray(child.child));
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
