import { ArchimateSchema } from "./interfaces/schema/ArchimateSchema.mjs";
import { Folder as SchemaFolder } from "./interfaces/schema/Folder.mjs";
import { Element as SchemaElement } from "./interfaces/schema/Element.mjs";
import { ChildElement } from "./interfaces/schema/ChildElement.mjs";
import { SourceConnection as SchemaSourceConnection } from "./interfaces/schema/SourceConnection.mjs";
import { Bounds as SchemaBounds } from "./interfaces/schema/Bounds.mjs";
import { Property as SchemaProperty } from "./interfaces/schema/Property.mjs";
import { Element } from './interfaces/Element.mjs';
import { Model } from './interfaces/Model.mjs';
import { Child } from './interfaces/Child.mjs';
import { Bounds } from './interfaces/Bounds.mjs';
import { SourceConnection } from './interfaces/SourceConnection.mjs';

const ARCHIMATE_PREFIX = 'archimate:'

const folderType = new Map<string, string>(
  [
    ['strategy', 'Strategy'],
    ['business', 'Business'],
    ['application', 'Application'],
    ['technology', 'Technology & Physical'],
    ['motivation', 'Motivation'],
    ['implementation_migration', 'Implementation & Migration'],
    ['other', 'Other'],
    ['relations', 'Relations'],
    ['diagrams', 'Views'],
  ]
);

class Archimate {

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
        id: this.generateRandomId()
      };
    });

    return model;
  }



  private generateRandomId(): string {
    const characters = 'abcdef0123456789';
    const idLength = 32;
    let randomId = 'id-';

    for (let i = 0; i < idLength; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      randomId += characters.charAt(randomIndex);
    }

    return randomId;
  }

  public load(input: object) {
    const data = input as ArchimateSchema
    this.name = data['archimate:model']['@_name']
    Object.keys(this.model).forEach((key) => this.loadFolder(data, key as keyof Model))
  }

  private loadChildren(el: object[], child: ChildElement | ChildElement[]): object[] {
    const children = Array.isArray(child) ? child : [child];
    children.forEach(c => {
      const j = this.convertChildElementToChild(c);
      if (c.child) {
        j.child = [];
        this.loadChildren(j.child, c.child);
      }
      el.push(j);
    });
    return el;
  }
  

  private saveChildren(childElements: ChildElement[], children: Child[]): ChildElement[] {
    children.forEach(child => {
      const el: ChildElement = {
        '@_xsi:type': `${ARCHIMATE_PREFIX}${child.type}`,
        '@_id': child.id,
        '@_targetConnections': child.targetConnections,
        '@_name': child.name,
        '@_textAlignment': child.textAlignment !== undefined ? String(child.textAlignment) : undefined,
        '@_fillColor': child.fillColor,
        '@_archimateElement': child.archimateElement,
        bounds: this.boundsToSchemaBounds(child.bounds),
        sourceConnection: child.sourceConnection ? this.sourceConnectionToSchemaSourceConnection(child.sourceConnection) : undefined,
      };

      if (child.child && Array.isArray(child.child)) {
        el.child = []
        el.child = this.saveChildren(el.child, child.child);
      }
      childElements.push(el);
      if (child.documentation) {
        el.documentation = child.documentation
      }

      if (child.fillColor) {
        el['@_fillColor'] = child.fillColor
      }
    });
    return childElements;
  }

  private schemaBoundsToBounds(b: SchemaBounds): Bounds {
    return {
      x: Number(b['@_x']),
      y: Number(b['@_y']),
      height: Number(b['@_height']),
      width: Number(b['@_width'])
    }
  }

  private boundsToSchemaBounds(b: Bounds): SchemaBounds {
    return {
      '@_x': String(b.x),
      '@_y': String(b.y),
      '@_width': String(b.width),
      '@_height': String(b.height)
    };
  }

  private SchemaSourceConnectionToSourceConnection(b: SchemaSourceConnection): SourceConnection {
    return {
      id: b['@_id'],
      archimateRelationship: b['@_archimateRelationship'],
      source: b['@_source'],
      target: b['@_target'],
      type: b['@_xsi:type'].replace(ARCHIMATE_PREFIX, '')
    }
  }

  private sourceConnectionToSchemaSourceConnection(b: SourceConnection): SchemaSourceConnection {
    return {
      '@_xsi:type': `${ARCHIMATE_PREFIX}${b.type}`,
      '@_id': b.id,
      '@_source': b.source,
      '@_target': b.target,
      '@_archimateRelationship': b.archimateRelationship
    };
  }

  private convertChildElementToChild(el: ChildElement): Child {
    const {
      '@_id': id,
      '@_xsi:type': type,
      '@_name': name,
      '@_archimateElement': archimateElement,
      '@_targetConnections': targetConnections,
      '@_fillColor': fillColor,
      '@_textAlignment': textAlignment,
      sourceConnection,
      bounds,
      documentation
    } = el;

    const o: Child = {
      id,
      type: type.replace(ARCHIMATE_PREFIX, ''),
      bounds: this.schemaBoundsToBounds(bounds),
      name,
      archimateElement,
      targetConnections,
      fillColor,
      textAlignment: textAlignment ? Number(textAlignment) : undefined,
      sourceConnection: sourceConnection ? this.SchemaSourceConnectionToSourceConnection(sourceConnection) : undefined,
      documentation
    };
    return this.removeUndefinedProperties(o) as Child;
  }

  private removeUndefinedProperties(obj: object): object {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});
  }

  private loadFolder(data: ArchimateSchema, folderKey: keyof Model) {
    const folder: SchemaFolder | undefined = this.findFolder(data, folderKey);
    if (folder) {
      this.setFolderMetadata(folderKey, folder);
      this.processFolderElements(folderKey, folder);
    }
  }

  private findFolder(data: ArchimateSchema, folderKey: keyof Model): SchemaFolder | undefined {
    return data['archimate:model'].folder.find((elm) => elm['@_type'] === folderKey);
  }

  private setFolderMetadata(folderKey: keyof Model, folder: SchemaFolder) {
    this.model[folderKey].id = folder['@_id'];
    this.model[folderKey].name = folder['@_name'];
  }

  private processFolderElements(folderKey: keyof Model, folder: SchemaFolder) {
    if (folder?.element) {
      const elements = Array.isArray(folder.element) ? folder.element : [folder.element];
      this.model[folderKey].elements = [];
      elements.forEach((element: SchemaElement) => {
        const el = this.createElement(element);
        this.model[folderKey].elements?.push(el);
      });
    }
  }

  private createElement(element: SchemaElement): Element {
    const el = {
      id: element['@_id'],
      name: element['@_name'],
      type: element['@_xsi:type'].replace(/^archimate:/, ''),
      source: element['@_source'] || undefined,
      target: element['@_target'] || undefined,
      documentation: element.documentation || undefined,
      properties: new Map<string, string>(),
      child: element.child ? this.loadChildren([], element.child) as Child[] : undefined
    } as Element;

    this.populateElementProperties(el, element);
    return el;
  }

  private populateElementProperties(el: Element, element: SchemaElement) {
    if (Array.isArray(element.property)) {
      element.property.forEach(p => el.properties.set(p['@_key'], p['@_value']));
    } else if (typeof element.property === 'object' && element.property !== null) {
      el.properties.set(element.property['@_key'], element.property['@_value']);
    }
  }


  public store(): object {
    const out: ArchimateSchema = {
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      'archimate:model': {
        folder: [],
        '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        '@_xmlns:archimate': 'http://www.archimatetool.com/archimate',
        '@_name': this.name,
        '@_id': 'id-d81fe19001de4c3cb53c05c2b757d35d',
        '@_version': '5.0.0'
      }
    }
    Object.keys(this.model).forEach((key) => this.storeFolder(out, key as keyof Model))

    return out;
  }

  private storeFolder(out: ArchimateSchema, folderKey: keyof Model) {
    const f = this.model[folderKey];

    if (Array.isArray(f.elements)) {
      const elements = f.elements.map(el => {
        const properties: SchemaProperty[] = []

        if (el.properties) {
          el.properties.forEach((value, key) => properties.push({ '@_key': key, '@_value': value }))
        }

        const l = {
          '@_xsi:type': `${ARCHIMATE_PREFIX}${el.type}`,
          '@_name': el.name,
          '@_id': el.id,
        } as SchemaElement;

        if (el.documentation) {
          l.documentation = el.documentation
        }

        if (properties) {
          l.property = properties
        }

        if (el.source && el.target) {
          l['@_source'] = el.source
          l['@_target'] = el.target
        }

        if (el.child) {
          l.child = this.saveChildren([], el.child)
        }
        return l
      })

      const folder: SchemaFolder = {
        element: elements,
        '@_name': folderType.get(folderKey) as string,
        '@_id': f.id,
        '@_type': folderKey
      };

      out['archimate:model'].folder.push(folder);
    } else {
      const folder: SchemaFolder = {
        '@_name': folderType.get(folderKey) as string,
        '@_id': f.id,
        '@_type': folderKey
      };

      out['archimate:model'].folder.push(folder);
    }
  }
}

export { Archimate }
