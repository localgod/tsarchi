/**
 * The JSON Schema (draft 2020-12) of tsarchi's JSON format, version 1, as `Archimate.toJson()` writes it and
 * `ModelJson` types it. It is also published as `schema/model-v1.json` in the repository and the package, under its
 * `$id`, so code outside TypeScript can validate the format.
 */

const id = { type: 'string', minLength: 1 } as const;
const ids = { type: 'array', items: id } as const;
const text = { type: 'string' } as const;
const number = { anyOf: [{ type: 'number' }, { enum: ['NaN', 'Infinity', '-Infinity'] }] } as const;
const code = (names: readonly string[]) => ({ anyOf: [{ enum: names }, { $ref: '#/$defs/number' }] }) as const;
const entries = { type: 'array', items: { $ref: '#/$defs/entry' } } as const;
const extensions = { $ref: '#/$defs/extensions' } as const;
/** The properties hold when the child's type is one of `types`, or when it is not, with `is` false. */
const whenType = (types: string[], properties: Record<string, unknown>, is = true) => {
  const matches = { properties: { type: { enum: types } } };
  return { anyOf: [is ? { not: matches } : matches, { properties }] } as const;
};

const folder = {
  id,
  name: text,
  documentation: text,
  properties: entries,
  features: entries,
  members: { ...ids, description: 'Ids of the elements, relationships or views placed directly in this folder, in file order.' },
  folders: { type: 'array', items: { $ref: '#/$defs/folder' } },
  extensions,
} as const;

const concept = { id, type: id, name: text, documentation: text, properties: entries, features: entries, extensions } as const;

export const modelJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://raw.githubusercontent.com/localgod/tsarchi/main/schema/model-v1.json',
  title: 'tsarchi model',
  description:
    "An Archi model in tsarchi's lossless JSON format, version 1. Concepts are in flat lists sorted by id; each folder lists its members in file order; diagram children and connections are in file order.",
  type: 'object',
  required: ['formatVersion', 'model', 'folders', 'elements', 'relationships', 'views'],
  additionalProperties: false,
  properties: {
    formatVersion: { const: 1 },
    model: {
      type: 'object',
      required: ['id', 'version'],
      additionalProperties: false,
      properties: {
        id,
        name: text,
        version: text,
        purpose: text,
        properties: entries,
        metadata: { ...entries, description: 'An empty list is an empty <metadata/>.' },
        extensions,
      },
    },
    profiles: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id'],
        additionalProperties: false,
        properties: { id, name: text, conceptType: text, imagePath: text, specialization: { type: 'boolean' }, features: entries },
      },
    },
    folders: {
      description: "The nine top-level folders, in Archi's order.",
      type: 'array',
      prefixItems: [
        'strategy',
        'business',
        'application',
        'technology',
        'motivation',
        'implementation_migration',
        'other',
        'relations',
        'diagrams',
      ].map(type => ({
        type: 'object',
        required: ['id', 'type'],
        additionalProperties: false,
        properties: { ...folder, type: { const: type } },
      })),
      minItems: 9,
      maxItems: 9,
    },
    elements: { type: 'array', items: { $ref: '#/$defs/element' } },
    relationships: { type: 'array', items: { $ref: '#/$defs/relationship' } },
    views: { type: 'array', items: { $ref: '#/$defs/view' } },
    extensions: {
      type: 'object',
      additionalProperties: false,
      properties: {
        xmlDeclaration: {
          type: 'array',
          items: { type: 'object', required: ['name', 'value'], additionalProperties: false, properties: { name: text, value: text } },
        },
        namespaces: {
          type: 'array',
          items: { type: 'object', required: ['prefix', 'uri'], additionalProperties: false, properties: { prefix: text, uri: text } },
        },
      },
    },
  },
  $defs: {
    number,
    entry: { type: 'object', additionalProperties: false, properties: { key: text, value: text } },
    extensions: {
      description:
        'Content tsarchi does not map, as one XML element named extensions. It is written back unchanged and is not part of the format.',
      type: 'string',
    },
    folder: { type: 'object', required: ['id'], additionalProperties: false, properties: folder },
    element: {
      type: 'object',
      required: ['id', 'type'],
      additionalProperties: false,
      properties: { ...concept, profiles: ids, junctionType: text },
    },
    relationship: {
      type: 'object',
      required: ['id', 'type'],
      additionalProperties: false,
      properties: {
        ...concept,
        profiles: ids,
        source: id,
        target: id,
        accessType: code(['write', 'read', 'unspecified', 'readWrite']),
        directed: { type: 'boolean' },
        strength: text,
      },
    },
    view: {
      type: 'object',
      required: ['id', 'type'],
      additionalProperties: false,
      properties: {
        ...concept,
        viewpoint: text,
        background: { $ref: '#/$defs/number' },
        connectionRouterType: code(['manual', 'manhattan']),
        children: { type: 'array', items: { $ref: '#/$defs/child' } },
        connections: { type: 'array', items: { $ref: '#/$defs/connection' } },
      },
    },
    child: {
      type: 'object',
      required: ['id', 'type', 'bounds'],
      additionalProperties: false,
      properties: {
        id,
        type: id,
        name: text,
        archimateElement: id,
        model: id,
        bounds: {
          type: 'object',
          required: ['x', 'y', 'width', 'height'],
          additionalProperties: false,
          properties: {
            x: { $ref: '#/$defs/number' },
            y: { $ref: '#/$defs/number' },
            width: { $ref: '#/$defs/number' },
            height: { $ref: '#/$defs/number' },
          },
        },
        figure: code(['default', 'alternate']),
        textAlignment: code(['left', 'center', 'right']),
        textPosition: code(['top', 'center', 'bottom']),
        fillColor: text,
        alpha: { $ref: '#/$defs/number' },
        lineColor: text,
        lineWidth: { $ref: '#/$defs/number' },
        font: text,
        fontColor: text,
        borderType: code(['tabbed', 'rectangle', 'dogEar', 'none']),
        borderColor: text,
        imagePath: text,
        imagePosition: { $ref: '#/$defs/number' },
        locked: { type: 'boolean' },
        hintTitle: text,
        targetConnections: ids,
        documentation: text,
        content: text,
        notes: text,
        hintContent: text,
        properties: entries,
        features: { ...entries, description: 'Every <feature>, style settings such as lineAlpha and gradient included, in file order.' },
        children: { type: 'array', items: { $ref: '#/$defs/child' } },
        extensions,
      },
      // The named codes depend on the child's type; other types keep the number. "Type is T, or the field is a
      // name of T's codes" is JSON Schema's if/then, written without a `then` key.
      allOf: [
        whenType(['Group'], { borderType: code(['tabbed', 'rectangle']) }),
        whenType(['Note'], { borderType: code(['dogEar', 'rectangle', 'none']) }),
        whenType(['Group', 'Note'], { borderType: { $ref: '#/$defs/number' } }, false),
        whenType(['DiagramObject'], { figure: { $ref: '#/$defs/number' } }, false),
      ],
    },
    connection: {
      type: 'object',
      required: ['id', 'type', 'source'],
      additionalProperties: false,
      properties: {
        id,
        type: id,
        implicitType: { const: true },
        source: { ...id, description: 'The diagram child or connection it starts on, which also holds it in the file.' },
        target: id,
        archimateRelationship: id,
        name: text,
        lineStyle: { $ref: '#/$defs/number' },
        font: text,
        fontColor: text,
        lineColor: text,
        lineWidth: { $ref: '#/$defs/number' },
        textAlignment: code(['left', 'center', 'right']),
        textPosition: code(['source', 'middle', 'target']),
        locked: { type: 'boolean' },
        targetConnections: ids,
        documentation: text,
        bendpoints: {
          type: 'array',
          items: {
            type: 'object',
            required: ['startX', 'startY', 'endX', 'endY'],
            additionalProperties: false,
            properties: {
              startX: { $ref: '#/$defs/number' },
              startY: { $ref: '#/$defs/number' },
              endX: { $ref: '#/$defs/number' },
              endY: { $ref: '#/$defs/number' },
            },
          },
        },
        properties: entries,
        features: entries,
        extensions,
      },
    },
  },
} as const;
