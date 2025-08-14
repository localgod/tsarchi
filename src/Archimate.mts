import type { Model, FolderKey } from './interfaces/Model.mjs';
import type { Schema as ArchimateSchema } from './interfaces/schema/Schema.mjs';
import type { Element } from './interfaces/Element.mjs';
import { Parser } from './Parser.mjs'
import { Serializer } from './Serializer.mjs'
import { folderType, elementTypeToFolderKey } from './constants/archimate-mappings.mjs';

export class Archimate {

  private name: string

  private model: Model

  public constructor() {
    this.name = ''
    this.model = this.init()
  }

  private init(): Model {
    return Array.from(folderType.entries()).reduce((acc, [key, name]) => {
      acc[key as FolderKey] = {
        name,
        id: this.generateRandomId(),
        elements: [],
      };
      return acc;
    }, {} as Model);
  }

  public generateRandomId(): string {
    const characters = 'abcdef0123456789';
    const idLength = 32;
    let randomId = 'id-';

    for (let i = 0; i < idLength; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      randomId += characters.charAt(randomIndex);
    }

    return randomId;
  }

  /**
   * Inserts or updates an element in the appropriate folder.
   * Updates are matched on `name` + `type`, not `id`.
   * When updating, existing `id` is preserved.
   * Only provided properties are overwritten; others remain unchanged.
   * @param element Partial or full element data to insert or update.
   */
  public upsertElement(element: Partial<Element> & Pick<Element, 'name' | 'type'>): void {
    const folderKey = elementTypeToFolderKey.get(element.type);

    if (!folderKey) {
      throw new Error(`Unknown element type "${element.type}".`);
    }

    const folder = this.model[folderKey];

    if (!folder.elements) {
      folder.elements = [];
    }

    const existingIndex = folder.elements.findIndex(
      e => e.name === element.name && e.type === element.type
    );

    if (existingIndex >= 0) {
      const existingElement = folder.elements[existingIndex];

      for (const [key, value] of Object.entries(element)) {
        if (value === undefined) continue;

        if (key === 'id') {
          // Always keep the original id
          continue;
        }

        if (key === 'properties' && value instanceof Map) {
          if (!(existingElement.properties instanceof Map)) {
            existingElement.properties = new Map();
          }
          for (const [propKey, propValue] of value.entries()) {
            existingElement.properties.set(propKey, propValue);
          }
        } else {
          (existingElement as any)[key] = value;
        }
      }

      console.log(`Updated element "${existingElement.name}" (Type: ${existingElement.type}) in folder "${folderType.get(folderKey)}".`);
    } else {
      if (!('id' in element) || !element.id) {
        element.id = this.generateRandomId();
      }
      folder.elements.push(element as Element);
      console.log(`Added element "${element.name}" (ID: ${element.id}, Type: ${element.type}) to folder "${folderType.get(folderKey)}".`);
    }
  }

  /**
   * Finds an element with the given name within a specific folder.
   * @param folderKey The key of the folder to search within.
   * @param elementName The name of the element to find.
   * @returns The Element object if found, otherwise null.
   */
  public findElementInFolderByName(folderKey: FolderKey, elementName: string): Element | null {
    const folder = this.model[folderKey];
    return folder?.elements?.find(el => el.name === elementName) || null;
  }

  public parse(input: ArchimateSchema): void {
    const parser = new Parser(this.model);
    this.model = parser.parse(input);
    this.name = input['archimate:model']?.['@_name'] || 'Unnamed Model';
  }

  public serialize(): ArchimateSchema {
    const serializer = new Serializer(this.model)
    return serializer.serialize(this.name)
  }
}
