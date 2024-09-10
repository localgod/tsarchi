import { Schema as ArchimateSchema } from "./interfaces/schema/Schema.mjs";
import { Folder as SchemaFolder } from "./interfaces/schema/Folder.mjs";
import { Element as SchemaElement } from "./interfaces/schema/Element.mjs";
import { Element } from "./interfaces/Element.mjs";
import { Child as SchemaChild } from "./interfaces/schema/Child.mjs";
import { Property as SchemaProperty } from "./interfaces/schema/Property.mjs";
import { Model } from './interfaces/Model.mjs';
import { Child } from './interfaces/Child.mjs';
import { BoundsMapper } from './BoundMapper.mjs';
import { SourceConnectionMapper } from './SourceConnectionMapper.mjs';

const folderType = new Map<string, string>([
  ['strategy', 'Strategy'],
  ['business', 'Business'],
  ['application', 'Application'],
  ['technology', 'Technology & Physical'],
  ['motivation', 'Motivation'],
  ['implementation_migration', 'Implementation & Migration'],
  ['other', 'Other'],
  ['relations', 'Relations'],
  ['diagrams', 'Views'],
]);

export class Serializer {
  private model: Model
  private name:string

  constructor(model: Model) {
    this.model = model;
    this.name = ''
  }

  public serialize(name:string): ArchimateSchema {
    this.name = name
    const schema: ArchimateSchema = this.createSchemaModel();

    Object.keys(this.model).forEach((key) => this.storeFolder(schema, key as keyof Model));

    return schema;
  }

  private createSchemaModel(): ArchimateSchema {
    return {
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      'archimate:model': {
        folder: [],
        '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        '@_xmlns:archimate': 'http://www.archimatetool.com/archimate',
        '@_name': this.name,
        '@_id': 'id-d81fe19001de4c3cb53c05c2b757d35d',
        '@_version': '5.0.0',
      },
    };
  }

  private storeFolder(schema: ArchimateSchema, folderKey: keyof Model): void {
    const folderModel = this.model[folderKey];

    const folder: SchemaFolder = {
      '@_name': folderType.get(folderKey) ?? 'Unknown Folder',
      '@_id': folderModel.id,
      '@_type': folderKey,
      element: [],
    };

    if (Array.isArray(folderModel.elements)) {
      folder.element = folderModel.elements.map((el) => this.serializeElement(el))
    }

    schema['archimate:model'].folder.push(folder);
  }

  private serializeElement(el: Element): SchemaElement {
    const element: SchemaElement = {
      '@_xsi:type': `archimate:${el.type}`,
      '@_name': el.name,
      '@_id': el.id,
    };

    if (el.documentation) {
      element.documentation = el.documentation;
    }

    if (el.properties) {
      element.property = this.serializeProperties(el.properties);
    }

    if (el.source && el.target) {
      element['@_source'] = el.source;
      element['@_target'] = el.target;
    }

    if (el.child) {
      const children = Array.isArray(el.child) ? el.child : [el.child];
      element.child = this.saveChildren(children);
    }

    return element;
  }

  private serializeProperties(properties: Map<string, string>): SchemaProperty[] {
    const propertyArray: SchemaProperty[] = [];

    properties.forEach((value, key) => {
      propertyArray.push({ '@_key': key, '@_value': value });
    });

    return propertyArray;
  }

  private saveChildren(children: Child[]): SchemaChild[] {
    return children.map((child) => this.serializeChild(child));
  }

  /**
   * Serialize a Child object into a SchemaChild
   *
   * For testability it is important that optional properties are only added if they are set and in the correct order.
   */
  private serializeChild(child: Child): SchemaChild {
    const schemaChild: SchemaChild = {
      '@_xsi:type': `archimate:${child.type}`,
      '@_id': child.id,
      bounds: BoundsMapper.boundsToSchemaBounds(child.bounds)
    }

    if (child.sourceConnection) {
      schemaChild.sourceConnection = SourceConnectionMapper.toSchemaSourceConnection(child.sourceConnection)
    }

    if (child.name) {
      schemaChild['@_name'] = child.name
    }

    if (child.targetConnections) {
      schemaChild['@_targetConnections'] = child.targetConnections
    }

    if (child.textAlignment) {
      schemaChild['@_textAlignment'] = String(child.textAlignment)
    }
    if (child.fillColor) {
      schemaChild['@_fillColor'] = child.fillColor
    }

    if(child.archimateElement) {
      schemaChild['@_archimateElement'] = child.archimateElement
    }

    if (child.child && Array.isArray(child.child)) {
      schemaChild.child = this.saveChildren(child.child);
    }

    if (child.documentation) {
      schemaChild.documentation = child.documentation;
    }

    return schemaChild;
  }
}
