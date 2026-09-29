import type { Bendpoint as SchemaBendpoint } from "./interfaces/schema/Bendpoint.mjs";
import type { Feature as SchemaFeature } from "./interfaces/schema/Feature.mjs";
import type { Property as SchemaProperty } from "./interfaces/schema/Property.mjs";
import type { ViewBendpoint } from "./interfaces/View.mjs";

type AttributeKind = 'string' | 'number' | 'boolean';

/**
 * Maps a model property to an XML attribute (without the '@_' prefix) and the value type it holds.
 */
export type AttributeSpec = readonly [property: string, attribute: string, kind: AttributeKind];

/**
 * Style and content attributes Archi writes on diagram children in ArchiMate, sketch and canvas views.
 */
export const childAttributes: readonly AttributeSpec[] = [
  ['name', 'name', 'string'],
  ['targetConnections', 'targetConnections', 'string'],
  ['archimateElement', 'archimateElement', 'string'],
  ['textAlignment', 'textAlignment', 'number'],
  ['textPosition', 'textPosition', 'number'],
  ['fillColor', 'fillColor', 'string'],
  ['alpha', 'alpha', 'number'],
  ['lineColor', 'lineColor', 'string'],
  ['lineWidth', 'lineWidth', 'number'],
  ['font', 'font', 'string'],
  ['fontColor', 'fontColor', 'string'],
  ['borderType', 'borderType', 'number'],
  ['borderColor', 'borderColor', 'string'],
  ['imagePath', 'imagePath', 'string'],
  ['imagePosition', 'imagePosition', 'number'],
  ['locked', 'locked', 'boolean'],
  ['hintTitle', 'hintTitle', 'string'],
  ['figure', 'type', 'number'],
  ['model', 'model', 'string'],
];

/**
 * Style settings Archi stores on diagram children as `<feature name="…" value="…"/>` rather than as attributes
 * (`FEATURE_*` constants in Archi's `IDiagramModelObject.java`). The spec's second entry is the feature name.
 */
export const childFeatures: readonly AttributeSpec[] = [
  ['lineAlpha', 'lineAlpha', 'number'],
  ['gradient', 'gradient', 'number'],
  ['iconVisible', 'iconVisible', 'number'],
  ['iconColor', 'iconColor', 'string'],
  ['deriveElementLineColor', 'deriveElementLineColor', 'boolean'],
  ['lineStyle', 'lineStyle', 'number'],
];

/**
 * Attributes Archi writes on view connections, besides id, source, target and archimateRelationship.
 */
export const connectionAttributes: readonly AttributeSpec[] = [
  ['name', 'name', 'string'],
  ['targetConnections', 'targetConnections', 'string'],
  ['lineStyle', 'type', 'number'],
  ['font', 'font', 'string'],
  ['fontColor', 'fontColor', 'string'],
  ['lineColor', 'lineColor', 'string'],
  ['lineWidth', 'lineWidth', 'number'],
  ['textAlignment', 'textAlignment', 'number'],
  ['textPosition', 'textPosition', 'number'],
  ['locked', 'locked', 'boolean'],
];

/**
 * Settings Archi stores on view connections as `<feature name="…" value="…"/>` (`FEATURE_*` constants in Archi's
 * `IDiagramModelConnection.java`). The spec's second entry is the feature name.
 */
export const connectionFeatures: readonly AttributeSpec[] = [
  ['nameVisible', 'nameVisible', 'boolean'],
  ['textRelativePosition', 'textRelativePosition', 'number'],
];

/**
 * Text content Archi writes as child elements rather than attributes.
 */
export const childTextElements = ['documentation', 'content', 'notes', 'hintContent'] as const;

export class DiagramAttributeMapper {
  /**
   * Reads the given attributes from a parsed XML node into model properties, skipping absent ones.
   */
  public static readAttributes(node: object, specs: readonly AttributeSpec[]): Record<string, string | number | boolean> {
    const source = node as Record<string, unknown>;
    const result: Record<string, string | number | boolean> = {};
    for (const [property, attribute, kind] of specs) {
      const raw = source[`@_${attribute}`];
      if (raw === undefined || raw === null) continue;
      result[property] = kind === 'number' ? Number(raw)
        : kind === 'boolean' ? String(raw) === 'true'
        : String(raw);
    }
    return result;
  }

  /**
   * Writes the given model properties as XML attributes, skipping unset ones.
   */
  public static writeAttributes(model: object, specs: readonly AttributeSpec[]): Record<string, string> {
    const source = model as Record<string, unknown>;
    const result: Record<string, string> = {};
    for (const [property, attribute] of specs) {
      const value = source[property];
      if (value === undefined || value === null) continue;
      result[`@_${attribute}`] = String(value);
    }
    return result;
  }

  public static schemaToProperties(property: SchemaProperty | SchemaProperty[] | undefined): Map<string, string> | undefined {
    if (!property) return undefined;
    const list = Array.isArray(property) ? property : [property];
    return new Map(list.map(p => [p['@_key'], p['@_value']]));
  }

  public static propertiesToSchema(properties: Map<string, string> | undefined): SchemaProperty[] | undefined {
    if (!properties || properties.size === 0) return undefined;
    return Array.from(properties, ([key, value]) => ({ '@_key': key, '@_value': value }));
  }

  public static schemaToFeatures(feature: SchemaFeature | SchemaFeature[] | undefined): Map<string, string> | undefined {
    if (!feature) return undefined;
    const list = Array.isArray(feature) ? feature : [feature];
    return new Map(list.map(f => [f['@_name'], String(f['@_value'])]));
  }

  public static featuresToSchema(features: Map<string, string> | undefined): SchemaFeature[] | undefined {
    if (!features || features.size === 0) return undefined;
    return Array.from(features, ([name, value]) => ({ '@_name': name, '@_value': value }));
  }

  /**
   * Reads the given features into model properties, skipping absent ones.
   */
  public static readFeatures(features: Map<string, string> | undefined, specs: readonly AttributeSpec[]): Record<string, string | number | boolean> {
    return DiagramAttributeMapper.readAttributes(
      Object.fromEntries(Array.from(features ?? [], ([name, value]) => [`@_${name}`, value])),
      specs,
    );
  }

  /**
   * Merges the given model properties into a copy of the features. A set property replaces the feature in place,
   * or is appended when new; an unset property removes it.
   */
  public static writeFeatures(model: object, features: Map<string, string> | undefined, specs: readonly AttributeSpec[]): Map<string, string> {
    const source = model as Record<string, unknown>;
    const result = new Map(features);
    for (const [property, name] of specs) {
      const value = source[property];
      if (value === undefined || value === null) {
        result.delete(name);
      } else {
        result.set(name, String(value));
      }
    }
    return result;
  }

  public static schemaToBendpoints(bendpoint: SchemaBendpoint | SchemaBendpoint[] | undefined): ViewBendpoint[] | undefined {
    if (!bendpoint) return undefined;
    const list = Array.isArray(bendpoint) ? bendpoint : [bendpoint];
    return list.map(b => ({
      startX: Number(b['@_startX']) || 0,
      startY: Number(b['@_startY']) || 0,
      endX: Number(b['@_endX']) || 0,
      endY: Number(b['@_endY']) || 0,
    }));
  }

  /**
   * Archi leaves out zero coordinates, so they are omitted here as well.
   */
  public static bendpointsToSchema(bendpoints: ViewBendpoint[] | undefined): SchemaBendpoint[] | undefined {
    if (!bendpoints || bendpoints.length === 0) return undefined;
    return bendpoints.map(b => {
      const schemaBendpoint: SchemaBendpoint = {};
      if (b.startX) schemaBendpoint['@_startX'] = String(b.startX);
      if (b.startY) schemaBendpoint['@_startY'] = String(b.startY);
      if (b.endX) schemaBendpoint['@_endX'] = String(b.endX);
      if (b.endY) schemaBendpoint['@_endY'] = String(b.endY);
      return schemaBendpoint;
    });
  }
}
