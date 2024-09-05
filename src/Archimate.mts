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
    return {
      strategy: {
        name: folderType.get('strategy')!,
        id: this.generateRandomId()
      },
      business: {
        name: folderType.get('business')!,
        id: this.generateRandomId()
      },
      application: {
        name: folderType.get('application')!,
        id: this.generateRandomId()
      },
      technology: {
        name: folderType.get('technology')!,
        id: this.generateRandomId()
      },
      motivation: {
        name: folderType.get('motivation')!,
        id: this.generateRandomId()
      },
      implementation_migration: {
        name: folderType.get('implementation_migration')!,
        id: this.generateRandomId()
      },
      other: {
        name: folderType.get('other')!,
        id: this.generateRandomId()
      },
      relations: {
        name: folderType.get('relations')!,
        id: this.generateRandomId()
      },
      diagrams: {
        name: folderType.get('diagrams')!,
        id: this.generateRandomId()
      }
    }
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

  private loadChildren(el: object[], child: ChildElement | ChildElement[]) {
    if (!Array.isArray(child)) {
      const j = this.convertChildElementToChild(child)
      if (child.child) {

        j.child = []
        this.loadChildren(j.child, child.child)
      }
      el.push(j)
    } else if (Array.isArray(child)) {
      child.forEach(c => {

        this.loadChildren(el, c)
      })
    }
    return el
  }

  private saveChildren(childElements: ChildElement[], children: Child[]): ChildElement[] {
    children.forEach(child => {
      const el: ChildElement = {
        '@_xsi:type': `archimate:${child.type}`,
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
      x: b['@_x'] as unknown as number,
      y: b['@_y'] as unknown as number,
      height: b['@_height'] as unknown as number,
      width: b['@_width'] as unknown as number
    }
  }

  private boundsToSchemaBounds(b: Bounds): SchemaBounds {
    return {
      '@_x': b.x as unknown as string,
      '@_y': b.y as unknown as string,
      '@_width': b.width as unknown as string,
      '@_height': b.height as unknown as string
    };
  }

  private SchemaSourceConnectionToSourceConnection(b: SchemaSourceConnection): SourceConnection {
    return {
      id: b['@_id'],
      archimateRelationship: b['@_archimateRelationship'],
      source: b['@_source'],
      target: b['@_target'],
      type: b['@_xsi:type'].replace('archimate:', '')
    }
  }

  private sourceConnectionToSchemaSourceConnection(b: SourceConnection): SchemaSourceConnection {
    return {
      '@_xsi:type': `archimate:${b.type}`,
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
      type: type.replace('archimate:', ''),
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
    const folder: SchemaFolder | undefined = data['archimate:model'].folder.find((elm) => elm['@_type'] === folderKey);
    if (folder) {

      this.model[folderKey].id = folder['@_id'];
      this.model[folderKey].name = folder['@_name']

      if (typeof folder?.element === 'object' && !Array.isArray(folder?.element) && folder?.element !== null) {
        folder.element = [folder?.element]
      }
      if (Array.isArray(folder?.element)) {

        this.model[folderKey].elements = [];
        folder.element.forEach((element: SchemaElement) => {

          const el = { id: element['@_id'], name: element['@_name'], type: element['@_xsi:type'].replace(/^archimate:/, '') } as Element;
          el.source = element['@_source'] ? element['@_source'] : el.source
          el.target = element['@_target'] ? element['@_target'] : el.target;
          el.documentation = element.documentation ? element.documentation : el.documentation

          el.properties = new Map<string, string>();
          if (Array.isArray(element.property)) {

            element.property.forEach(p => {
              el.properties?.set(p['@_key'], p['@_value']);
            });
          } else if (typeof element.property === 'object' && element.property !== null) {
            el.properties?.set(element.property['@_key'], element.property['@_value']);
          }

          if (element.child) {
            const jo = this.loadChildren([], element.child)
            el.child = jo

          }
          this.model[folderKey].elements?.push(el);
        });
      }
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
          '@_xsi:type': `archimate:${el.type}`,
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
