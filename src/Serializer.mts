import type { Schema as ArchimateSchema } from "./interfaces/schema/Schema.mjs";
import type { ModelAttributes } from "./interfaces/schema/Model.mjs";
import type { XmlMetadata } from "./interfaces/schema/XmlMetadata.mjs";
import type { Folder as SchemaFolder } from "./interfaces/schema/Folder.mjs";
import type { Element as SchemaElement } from "./interfaces/schema/Element.mjs";
import type { Element } from "./interfaces/Element.mjs";
import type { Child as SchemaChild } from "./interfaces/schema/Child.mjs";
import type { Property as SchemaProperty } from "./interfaces/schema/Property.mjs";
import type { Model } from './interfaces/Model.mjs';
import type { Folder } from './interfaces/Folder.mjs';
import type { Child } from './interfaces/Child.mjs';
import { BoundsMapper } from './BoundMapper.mjs';
import { SourceConnectionMapper } from './SourceConnectionMapper.mjs';
import { folderType, toXsiType } from './constants/archimate-mappings.mjs';
import { DiagramAttributeMapper, childAttributes, childTextElements } from './DiagramAttributeMapper.mjs';

export class Serializer {
  private model: Model
  private modelMetadata: ModelAttributes
  private xmlMetadata: XmlMetadata

  constructor(model: Model) {
    this.model = model;
    this.xmlMetadata = { '@_version': '1.0', '@_encoding': 'UTF-8' };
    this.modelMetadata = {
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@_xmlns:archimate': 'http://www.archimatetool.com/archimate',
      '@_name': '',
      '@_id': 'id-d81fe19001de4c3cb53c05c2b757d35d',
      '@_version': '5.0.0',
    };
  }

  public serialize(modelMetadata: ModelAttributes | string, xmlMetadata?: XmlMetadata, purpose?: string): ArchimateSchema {
    this.modelMetadata = typeof modelMetadata === 'string'
      ? { ...this.modelMetadata, '@_name': modelMetadata }
      : modelMetadata
    this.xmlMetadata = xmlMetadata || this.xmlMetadata
    const schema: ArchimateSchema = this.createSchemaModel();

    Object.keys(this.model).forEach((key) => this.storeFolder(schema, key as keyof Model));

    // Archi writes <purpose> after the folders.
    if (purpose) {
      schema['archimate:model'].purpose = purpose;
    }

    return schema;
  }

  private createSchemaModel(): ArchimateSchema {
    return {
      '?xml': this.xmlMetadata,
      'archimate:model': {
        folder: [],
        ...this.modelMetadata,
      },
    };
  }

  private storeFolder(schema: ArchimateSchema, folderKey: keyof Model): void {
    const folderModel = this.model[folderKey];

    const folder: SchemaFolder = {
      '@_name': folderModel.name || folderType.get(folderKey) || 'Unknown Folder',
      '@_id': folderModel.id,
      '@_type': folderKey,
    };
    this.addFolderDetails(folder, folderModel.documentation, folderModel.properties);

    const elements = Array.isArray(folderModel.elements) ? folderModel.elements : [];
    const elementsById = new Map(elements.map((el) => [el.id, el]));
    const placedIds = new Set<string>();

    if (folderModel.folders && folderModel.folders.length > 0) {
      folder.folder = folderModel.folders.map((subfolder) => this.serializeFolder(subfolder, elementsById, placedIds));
    }

    // Elements not claimed by a nested folder stay at the top level.
    folder.element = elements
      .filter((el) => !placedIds.has(el.id))
      .map((el) => this.serializeElement(el));

    schema['archimate:model'].folder.push(folder);
  }

  private serializeFolder(folderModel: Folder, elementsById: Map<string, Element>, placedIds: Set<string>): SchemaFolder {
    const folder: SchemaFolder = {
      '@_name': folderModel.name,
      '@_id': folderModel.id,
    };
    this.addFolderDetails(folder, folderModel.documentation, folderModel.properties);

    if (folderModel.folders && folderModel.folders.length > 0) {
      folder.folder = folderModel.folders.map((subfolder) => this.serializeFolder(subfolder, elementsById, placedIds));
    }

    // Ids of elements that were deleted, moved to another top-level folder, or already placed are skipped.
    const elements: SchemaElement[] = [];
    for (const id of folderModel.elementIds || []) {
      const element = elementsById.get(id);
      if (!element || placedIds.has(id)) continue;
      placedIds.add(id);
      elements.push(this.serializeElement(element));
    }
    if (elements.length > 0) {
      folder.element = elements;
    }

    return folder;
  }

  private addFolderDetails(folder: SchemaFolder, documentation?: string, properties?: Map<string, string>): void {
    if (documentation) {
      folder.documentation = documentation;
    }

    if (properties && properties.size > 0) {
      folder.property = this.serializeProperties(properties);
    }
  }

  private serializeElement(el: Element): SchemaElement {
    const element: SchemaElement = {
      '@_xsi:type': toXsiType(el.type),
      '@_name': el.name,
      '@_id': el.id,
    };

    if (el.viewpoint !== undefined) {
      element['@_viewpoint'] = el.viewpoint;
    }
    if (el.background !== undefined) {
      element['@_background'] = String(el.background);
    }
    if (el.connectionRouterType !== undefined) {
      element['@_connectionRouterType'] = String(el.connectionRouterType);
    }

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

    if (el.accessType !== undefined) {
      element['@_accessType'] = String(el.accessType);
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
      '@_xsi:type': toXsiType(child.type),
      '@_id': child.id,
      ...DiagramAttributeMapper.writeAttributes(child, childAttributes),
      bounds: BoundsMapper.boundsToSchemaBounds(child.bounds)
    }

    if (child.sourceConnection) {
      schemaChild.sourceConnection = SourceConnectionMapper.toSchemaSourceConnections(child.sourceConnection)
    }

    if (child.child && Array.isArray(child.child)) {
      schemaChild.child = this.saveChildren(child.child);
    }

    for (const key of childTextElements) {
      if (child[key]) {
        schemaChild[key] = child[key];
      }
    }

    const property = DiagramAttributeMapper.propertiesToSchema(child.properties);
    if (property) {
      schemaChild.property = property;
    }

    const feature = DiagramAttributeMapper.featuresToSchema(child.features);
    if (feature) {
      schemaChild.feature = feature;
    }

    return schemaChild;
  }
}
