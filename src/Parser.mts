import type { Model } from "./interfaces/Model.mjs";
import type { Schema as ArchimateSchema } from "./interfaces/schema/Schema.mjs";
import type { Folder as SchemaFolder } from "./interfaces/schema/Folder.mjs";
import type { Element as SchemaElement } from "./interfaces/schema/Element.mjs";
import type { Child as SchemaChild } from "./interfaces/schema/Child.mjs";
import type { Property as SchemaProperty } from "./interfaces/schema/Property.mjs";
import type { Element } from './interfaces/Element.mjs';
import type { Child } from './interfaces/Child.mjs';
import type { Folder } from './interfaces/Folder.mjs';
import type { ArchimateModelType } from './constants/archimate-mappings.mjs';
import { typeFromXsiType } from './constants/archimate-mappings.mjs';
import { BoundsMapper } from './BoundMapper.mjs';
import { SourceConnectionMapper } from './SourceConnectionMapper.mjs';
import { DiagramAttributeMapper, childAttributes, childTextElements } from './DiagramAttributeMapper.mjs';

export class Parser {
  private model: Model;

  constructor(model: Model) {
    this.model = model;
  }

  public parse(input: object): Model {
    const data = this.validateInput(input);
    Object.keys(this.model).forEach((key) => this.loadFolder(data, key as keyof Model));
    return this.model;
  }

  private validateInput(input: object): ArchimateSchema {
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid input data');
    }
    return input as ArchimateSchema;
  }

  private loadFolder(data: ArchimateSchema, folderKey: keyof Model): void {
    const folder = this.findFolder(data, folderKey);
    if (folder) {
      this.setFolderMetadata(folderKey, folder);
      this.processFolderElements(folderKey, folder);
    }
  }

  private findFolder(data: ArchimateSchema, folderKey: keyof Model): SchemaFolder | undefined {
    return data['archimate:model']?.folder?.find((elm) => elm['@_type'] === folderKey);
  }

  private setFolderMetadata(folderKey: keyof Model, folder: SchemaFolder): void {
    const folderModel = this.model[folderKey];
    folderModel.id = folder['@_id'] || '';
    folderModel.name = folder['@_name'] || '';
    folderModel.documentation = folder.documentation;
    folderModel.properties = this.createOptionalPropertiesMap(folder);
  }

  private processFolderElements(folderKey: keyof Model, folder: SchemaFolder): void {
    const elements: Element[] = [];
    const folders = this.loadSubfolders(folder.folder, elements);
    elements.push(...this.createElements(folder.element));

    this.model[folderKey].elements = elements;
    this.model[folderKey].folders = folders.length > 0 ? folders : undefined;
  }

  /**
   * Loads nested folders depth-first, collecting their elements into the
   * top-level folder's flat element list.
   */
  private loadSubfolders(schemaFolders: SchemaFolder | SchemaFolder[] | undefined, elements: Element[]): Folder[] {
    return this.ensureArray(schemaFolders).map((schemaFolder) => {
      const folders = this.loadSubfolders(schemaFolder.folder, elements);
      const folderElements = this.createElements(schemaFolder.element);
      elements.push(...folderElements);

      return this.cleanUndefinedProperties({
        id: schemaFolder['@_id'] || '',
        name: schemaFolder['@_name'] || '',
        documentation: schemaFolder.documentation,
        properties: this.createOptionalPropertiesMap(schemaFolder),
        elementIds: folderElements.length > 0 ? folderElements.map((element) => element.id) : undefined,
        folders: folders.length > 0 ? folders : undefined,
      } as Folder);
    });
  }

  private createElements(schemaElements: SchemaElement | SchemaElement[] | undefined): Element[] {
    return this.ensureArray(schemaElements).map((element: SchemaElement | undefined) =>
      element ? this.createElement(element) : undefined
    ).filter((el): el is Element => el !== undefined)
  }

  private ensureArray<T>(element: T | T[] | undefined): T[] {
    return Array.isArray(element) ? element : element ? [element] : [];
  }

  private createElement(schemaElement: SchemaElement): Element {
    const element: Element = {
      id: schemaElement['@_id'],
      name: schemaElement['@_name'],
      type: this.extractElementType(schemaElement['@_xsi:type']) as ArchimateModelType,
      source: schemaElement['@_source'],
      target: schemaElement['@_target'],
      documentation: schemaElement.documentation,
      properties: this.createPropertiesMap(schemaElement),
      child: schemaElement.child ? this.loadChildren(schemaElement.child) : undefined
    };

    const viewpoint = schemaElement['@_viewpoint'];
    const background = schemaElement['@_background'];
    const connectionRouterType = schemaElement['@_connectionRouterType'];
    if (viewpoint !== undefined) element.viewpoint = viewpoint;
    if (background !== undefined) element.background = Number(background);
    if (connectionRouterType !== undefined) element.connectionRouterType = Number(connectionRouterType);
    const accessType = schemaElement['@_accessType'];
    if (accessType !== undefined) element.accessType = Number(accessType);

    return element;
  }

  private extractElementType(typeString: string | undefined): string {
    return typeString ? typeFromXsiType(typeString) : 'Unknown'
  }

  private createOptionalPropertiesMap(source: { property?: SchemaProperty | SchemaProperty[] }): Map<string, string> | undefined {
    const properties = this.createPropertiesMap(source);
    return properties.size > 0 ? properties : undefined;
  }

  private createPropertiesMap(element: { property?: SchemaProperty | SchemaProperty[] }): Map<string, string> {
    const properties = new Map<string, string>();
    const propsArray = this.ensureArray(element.property);

    propsArray.forEach((property) => {
      if (property) {
        properties.set(property['@_key'], property['@_value'])
      }
    })

    return properties
  }

  private loadChildren(childElements: SchemaChild | SchemaChild[]): Child[] {
    const children = this.ensureArray(childElements)
    return children.map((child) => this.convertChildElementToChild(child))
  }

  private convertChildElementToChild(schemaChild: SchemaChild): Child {
    const { sourceConnection, bounds } = schemaChild;

    const child: Child = {
      id: schemaChild['@_id'],
      type: this.extractElementType(schemaChild['@_xsi:type']),
      ...DiagramAttributeMapper.readAttributes(schemaChild, childAttributes),
      bounds: BoundsMapper.schemaBoundsToBounds(bounds),
      sourceConnection: sourceConnection ? SourceConnectionMapper.schemaToSourceConnections(sourceConnection) : undefined,
      properties: DiagramAttributeMapper.schemaToProperties(schemaChild.property),
      features: DiagramAttributeMapper.schemaToFeatures(schemaChild.feature),
    }

    for (const key of childTextElements) {
      const value = schemaChild[key];
      if (value !== undefined) child[key] = String(value);
    }

    child.child = schemaChild.child ? this.loadChildren(schemaChild.child) : undefined;
    return this.cleanUndefinedProperties(child);
  }

  private cleanUndefinedProperties<T extends Record<string, any>>(obj: T): T {
    return Object.fromEntries(
      Object.entries(obj).filter(([, value]) => value !== undefined)
    ) as T;
  }

}
