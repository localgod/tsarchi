import { Model } from "./interfaces/Model.mjs";
import { Schema as ArchimateSchema } from "./interfaces/schema/Schema.mjs";
import { Folder as SchemaFolder } from "./interfaces/schema/Folder.mjs";
import { Element as SchemaElement } from "./interfaces/schema/Element.mjs";
import { Child as SchemaChild} from "./interfaces/schema/Child.mjs";
import { Element } from './interfaces/Element.mjs';
import { Child } from './interfaces/Child.mjs';
import { BoundsMapper } from './BoundMapper.mjs';
import { SourceConnectionMapper } from './SourceConnectionMapper.mjs';

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
  }

  private processFolderElements(folderKey: keyof Model, folder: SchemaFolder): void {
    const elements = this.ensureArray(folder.element);
    this.model[folderKey].elements = elements.map((element: SchemaElement | undefined) => 
      element ? this.createElement(element) : undefined
    ).filter((el): el is Element => el !== undefined)
  }

  private ensureArray<T>(element: T | T[]): T[] {
    return Array.isArray(element) ? element : element ? [element] : [];
  }

  private createElement(schemaElement: SchemaElement): Element {
    const element: Element = {
      id: schemaElement['@_id'],
      name: schemaElement['@_name'],
      type: this.extractElementType(schemaElement['@_xsi:type']),
      source: schemaElement['@_source'],
      target: schemaElement['@_target'],
      documentation: schemaElement.documentation,
      properties: this.createPropertiesMap(schemaElement),
      child: schemaElement.child ? this.loadChildren(schemaElement.child) : undefined
    };

    return element;
  }

  private extractElementType(typeString: string | undefined): string {
    return typeString ? typeString.replace(/^archimate:/, '') : 'Unknown'
  }

  private createPropertiesMap(element: SchemaElement): Map<string, string> {
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
    const {
      '@_id': id,
      '@_xsi:type': xsiType,
      '@_name': name,
      '@_archimateElement': archimateElement,
      '@_targetConnections': targetConnections,
      '@_fillColor': fillColor,
      '@_textAlignment': textAlignment,
      sourceConnection,
      bounds,
      documentation
    } = schemaChild;

    const child: Child = {
      id,
      type: this.extractElementType(xsiType),
      name,
      archimateElement,
      targetConnections,
      fillColor,
      textAlignment: textAlignment ? Number(textAlignment) : undefined,
      bounds: BoundsMapper.schemaBoundsToBounds(bounds),
      sourceConnection: sourceConnection ? SourceConnectionMapper.schemaToSourceConnection(sourceConnection) : undefined,
      documentation
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
