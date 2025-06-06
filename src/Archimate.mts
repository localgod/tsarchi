// src/Archimate.mts

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
    const model: Model = {} as Model;

    folderType.forEach((name, key) => {
      model[key as keyof Model] = {
        name,
        id: this.generateRandomId(),
        elements: [],
      };
    });

    return model;
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
   * Adds an element to the appropriate folder in the model based on its type.
   * @param element The element to add.
   * @throws Error if the target folder is not found.
   */
  public addElement(element: Element): void {
    const folderKey = elementTypeToFolderKey.get(element.type);

    if (!folderKey) {
      console.warn(`Warning: Unknown element type "${element.type}". Element will not be added to a specific folder.`);
      // Optionally, you could add it to the 'other' folder or throw an error
      // throw new Error(`Unknown element type: ${element.type}`);
      return; // Or handle as needed
    }

    const folder = this.model[folderKey];

    if (!folder) {
      // This should ideally not happen if init() is called correctly,
      // but it's a good safeguard.
      throw new Error(`Target folder "${folderKey}" not found in the model structure.`);
    }

    // Ensure the elements array exists
    if (!folder.elements) {
      folder.elements = [];
    }

    // Add the element to the folder's elements array
    folder.elements.push(element);
    console.log(`Added element "${element.name}" (ID: ${element.id}, Type: ${element.type}) to folder "${folderType.get(folderKey)}".`);
  }

  /**
   * Finds an element with the given name within a specific folder.
   * @param folderKey The key of the folder to search within.
   * @param elementName The name of the element to find.
   * @returns The Element object if found, otherwise null.
   */
  public findElementInFolderByName(folderKey: FolderKey, elementName: string): Element | null {
    const folder = this.model[folderKey];

    // Check if the folder exists and has an elements array
    if (folder && folder.elements && folder.elements.length > 0) {
      // Iterate through the elements in the specified folder
      for (const element of folder.elements) {
        // Check if the element's name matches the provided name
        // Using strict equality (case-sensitive)
        if (element.name === elementName) {
          return element; // Found the element, return it
        }
        // If you need case-insensitive comparison, use:
        // if (element.name.toLowerCase() === elementName.toLowerCase()) {
        //   return element;
        // }
      }
    }

    // Folder not found, or folder has no elements, or element not found in the folder
    return null;
  }


  public parse(input: object) {
    const parser = new Parser(this.model)
    this.model = parser.parse(input)
    this.name = (input as ArchimateSchema)['archimate:model']?.['@_name'] || 'Unnamed Model';
  }

  public serialize(): object {
    const serializer = new Serializer(this.model)
    return serializer.serialize(this.name)
  }
}
