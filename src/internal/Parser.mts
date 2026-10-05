import type { Model, ModelContent } from '../interfaces/Model.mjs';
import type { Profile } from '../interfaces/Profile.mjs';
import type { Profile as SchemaProfile } from '../interfaces/schema/Profile.mjs';
import type { Schema as ArchimateSchema } from '../interfaces/schema/Schema.mjs';
import type { Folder as SchemaFolder } from '../interfaces/schema/Folder.mjs';
import type { Element as SchemaElement } from '../interfaces/schema/Element.mjs';
import type { Child as SchemaChild } from '../interfaces/schema/Child.mjs';
import type { Property as SchemaProperty } from '../interfaces/schema/Property.mjs';
import type { Element } from '../interfaces/Element.mjs';
import type { Child } from '../interfaces/Child.mjs';
import type { Folder } from '../interfaces/Folder.mjs';
import type { ArchimateModelType } from '../constants/archimate-mappings.mjs';
import { typeFromXsiType } from '../constants/archimate-mappings.mjs';
import { BoundsMapper } from './BoundMapper.mjs';
import { SourceConnectionMapper } from './SourceConnectionMapper.mjs';
import {
  DiagramAttributeMapper,
  childAttributes,
  childFeatures,
  childTextElements,
  conceptAttributes,
  viewAttributes,
} from './DiagramAttributeMapper.mjs';
import type { AttributeSpec } from './DiagramAttributeMapper.mjs';
import { toArray } from './Arrays.mjs';

const attributeKeys = (specs: readonly AttributeSpec[]) => specs.map(([, attribute]) => `@_${attribute}`);

export class Parser {
  private model: Model;

  constructor(model: Model) {
    this.model = model;
  }

  public parse(input: object): Model {
    const data = this.validateInput(input);
    Object.keys(this.model).forEach(key => this.loadFolder(data, key as keyof Model));
    return this.model;
  }

  /**
   * Keys of `<archimate:model>` that are mapped elsewhere: the model attributes, folders and the content below.
   */
  private static readonly mappedModelKeys = new Set([
    '@_name',
    '@_id',
    '@_version',
    'folder',
    'purpose',
    'property',
    'metadata',
    'profile',
  ]);

  /**
   * Keys of a top-level `<folder>` that are mapped to `ModelFolder`. Nested folders have no mapped `type`.
   */
  private static readonly mappedFolderKeys = new Set([
    '@_name',
    '@_id',
    '@_type',
    'documentation',
    'property',
    'feature',
    'folder',
    'element',
  ]);
  private static readonly mappedSubfolderKeys = new Set([...Parser.mappedFolderKeys].filter(key => key !== '@_type'));

  /**
   * Keys of an `<element>` (element, relationship or view) that are mapped to `Element`.
   */
  private static readonly mappedElementKeys = new Set([
    '@_xsi:type',
    '@_name',
    '@_id',
    '@_profiles',
    '@_source',
    '@_target',
    ...attributeKeys(viewAttributes),
    ...attributeKeys(conceptAttributes),
    'documentation',
    'property',
    'feature',
    'child',
  ]);

  /**
   * Keys of a diagram `<child>` that are mapped to `Child`.
   */
  private static readonly mappedChildKeys = new Set([
    '@_xsi:type',
    '@_id',
    ...attributeKeys(childAttributes),
    ...childTextElements,
    'bounds',
    'sourceConnection',
    'property',
    'feature',
    'child',
  ]);

  /**
   * Reads the model-level content of `<archimate:model>` besides its folders.
   */
  public parseModelContent(input: object): ModelContent {
    const model = this.validateInput(input)['archimate:model'];
    if (!model) return {};

    const unrecognized = Object.fromEntries(
      Object.entries(model).filter(([key]) => !Parser.mappedModelKeys.has(key) && !key.startsWith('@_xmlns:'))
    );
    const metadata = model.metadata;
    const content: ModelContent = {
      purpose: model.purpose !== undefined ? String(model.purpose) : undefined,
      properties: this.createOptionalPropertiesMap(model),
      metadata: metadata !== undefined ? this.createPropertiesMap({ property: metadata === '' ? undefined : metadata.entry }) : undefined,
      profiles: model.profile !== undefined ? toArray(model.profile).map(profile => this.createProfile(profile)) : undefined,
      unrecognized: Object.keys(unrecognized).length > 0 ? unrecognized : undefined,
    };
    return this.cleanUndefinedProperties(content);
  }

  private createProfile(schemaProfile: SchemaProfile): Profile {
    const specialization = schemaProfile['@_specialization'];
    return this.cleanUndefinedProperties({
      id: schemaProfile['@_id'],
      name: schemaProfile['@_name'] ?? '',
      conceptType: schemaProfile['@_conceptType'],
      imagePath: schemaProfile['@_imagePath'],
      specialization: specialization !== undefined ? String(specialization) === 'true' : undefined,
      features: DiagramAttributeMapper.schemaToFeatures(schemaProfile.feature),
    } as Profile);
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
    return toArray(data['archimate:model']?.folder).find(elm => elm['@_type'] === folderKey);
  }

  private setFolderMetadata(folderKey: keyof Model, folder: SchemaFolder): void {
    Object.assign(this.model[folderKey], this.readFolderDetails(folder, Parser.mappedFolderKeys));
  }

  /**
   * Reads what top-level and nested folders have in common. Absent details are undefined.
   */
  private readFolderDetails(folder: SchemaFolder, mappedKeys: ReadonlySet<string>) {
    return {
      id: folder['@_id'] || '',
      name: folder['@_name'] || '',
      documentation: folder.documentation,
      properties: this.createOptionalPropertiesMap(folder),
      features: DiagramAttributeMapper.schemaToFeatures(folder.feature),
      unrecognized: DiagramAttributeMapper.readUnrecognized(folder, mappedKeys),
    };
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
    return toArray(schemaFolders).map(schemaFolder => {
      const folders = this.loadSubfolders(schemaFolder.folder, elements);
      const folderElements = this.createElements(schemaFolder.element);
      elements.push(...folderElements);

      return this.cleanUndefinedProperties({
        ...this.readFolderDetails(schemaFolder, Parser.mappedSubfolderKeys),
        elementIds: folderElements.length > 0 ? folderElements.map(element => element.id) : undefined,
        folders: folders.length > 0 ? folders : undefined,
      } as Folder);
    });
  }

  private createElements(schemaElements: SchemaElement | SchemaElement[] | undefined): Element[] {
    return toArray(schemaElements)
      .map((element: SchemaElement | undefined) => (element ? this.createElement(element) : undefined))
      .filter((el): el is Element => el !== undefined);
  }

  private createElement(schemaElement: SchemaElement): Element {
    const element: Element = {
      id: schemaElement['@_id'],
      name: schemaElement['@_name'] ?? '',
      // A missing or empty xsi:type stays empty, so validateModel reports missing-type instead of saving an invented type.
      type: (schemaElement['@_xsi:type'] ? typeFromXsiType(schemaElement['@_xsi:type']) : '') as ArchimateModelType,
      source: schemaElement['@_source'],
      target: schemaElement['@_target'],
      documentation: schemaElement.documentation,
      properties: this.createPropertiesMap(schemaElement),
      child: schemaElement.child ? this.loadChildren(schemaElement.child) : undefined,
    };

    const profiles = schemaElement['@_profiles'];
    if (profiles !== undefined) element.profiles = profiles;
    Object.assign(
      element,
      DiagramAttributeMapper.readAttributes(schemaElement, viewAttributes),
      DiagramAttributeMapper.readAttributes(schemaElement, conceptAttributes)
    );
    const features = DiagramAttributeMapper.schemaToFeatures(schemaElement.feature);
    if (features) element.features = features;
    const unrecognized = DiagramAttributeMapper.readUnrecognized(schemaElement, Parser.mappedElementKeys);
    if (unrecognized) element.unrecognized = unrecognized;

    return element;
  }

  private extractElementType(typeString: string | undefined): string {
    return typeString ? typeFromXsiType(typeString) : 'Unknown';
  }

  private createOptionalPropertiesMap(source: { property?: SchemaProperty | SchemaProperty[] }): Map<string, string> | undefined {
    const properties = this.createPropertiesMap(source);
    return properties.size > 0 ? properties : undefined;
  }

  private createPropertiesMap(element: { property?: SchemaProperty | SchemaProperty[] }): Map<string, string> {
    const properties = new Map<string, string>();
    toArray(element.property).forEach(property => {
      if (property) {
        properties.set(property['@_key'], property['@_value']);
      }
    });

    return properties;
  }

  private loadChildren(childElements: SchemaChild | SchemaChild[]): Child[] {
    return toArray(childElements).map(child => this.convertChildElementToChild(child));
  }

  private convertChildElementToChild(schemaChild: SchemaChild): Child {
    const { sourceConnection, bounds } = schemaChild;
    const features = DiagramAttributeMapper.schemaToFeatures(schemaChild.feature);

    const child: Child = {
      id: schemaChild['@_id'],
      type: this.extractElementType(schemaChild['@_xsi:type']),
      ...DiagramAttributeMapper.readAttributes(schemaChild, childAttributes),
      ...DiagramAttributeMapper.readFeatures(features, childFeatures),
      bounds: BoundsMapper.schemaBoundsToBounds(bounds),
      sourceConnection: sourceConnection ? SourceConnectionMapper.schemaToSourceConnections(sourceConnection) : undefined,
      properties: DiagramAttributeMapper.schemaToProperties(schemaChild.property),
      features,
      unrecognized: DiagramAttributeMapper.readUnrecognized(schemaChild, Parser.mappedChildKeys),
    };

    for (const key of childTextElements) {
      const value = schemaChild[key];
      if (value !== undefined) child[key] = String(value);
    }

    child.child = schemaChild.child ? this.loadChildren(schemaChild.child) : undefined;
    return this.cleanUndefinedProperties(child);
  }

  private cleanUndefinedProperties<T extends Record<string, any>>(obj: T): T {
    return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as T;
  }
}
