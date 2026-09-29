import { describe, expect, it } from 'vitest';
import { readFile } from 'fs/promises';
import { XMLParser } from 'fast-xml-parser';
import { Archimate } from '../src/Archimate.mjs';
import type { Child } from '../src/interfaces/Child.mjs';
import type { SourceConnection } from '../src/interfaces/SourceConnection.mjs';
import type { Schema } from '../src/interfaces/schema/Schema.mjs';
import type { Child as SchemaChild } from '../src/interfaces/schema/Child.mjs';
import type { Element as SchemaElement } from '../src/interfaces/schema/Element.mjs';
import type { Feature as SchemaFeature } from '../src/interfaces/schema/Feature.mjs';
import type { SourceConnection as SchemaSourceConnection } from '../src/interfaces/schema/SourceConnection.mjs';

async function parseFile(path: string): Promise<Archimate> {
  const xml = await readFile(path, 'utf8');
  const raw = new XMLParser({ ignoreAttributes: false }).parse(xml) as Schema;
  const archimate = new Archimate();
  archimate.parse(raw);
  return archimate;
}

function viewChildren(archimate: Archimate, viewId: string): Child[] {
  const child = archimate.getElement(viewId)?.child;
  return Array.isArray(child) ? child : child ? [child] : [];
}

function schemaChild(archimate: Archimate, viewId: string, childId: string): SchemaChild | undefined {
  const diagrams = archimate.serialize()['archimate:model'].folder.find(folder => folder['@_type'] === 'diagrams');
  const elements = diagrams?.element as SchemaElement | SchemaElement[] | undefined;
  const view = (Array.isArray(elements) ? elements : elements ? [elements] : []).find(element => element['@_id'] === viewId);
  const children = view?.child as SchemaChild | SchemaChild[] | undefined;
  return (Array.isArray(children) ? children : children ? [children] : []).find(child => child['@_id'] === childId);
}

function viewConnection(archimate: Archimate, viewId: string, childId: string): SourceConnection {
  const connection = viewChildren(archimate, viewId).find(child => child.id === childId)?.sourceConnection;
  return (Array.isArray(connection) ? connection[0] : connection)!;
}

function schemaConnection(archimate: Archimate, viewId: string, childId: string): SchemaSourceConnection | undefined {
  const connection = schemaChild(archimate, viewId, childId)?.sourceConnection;
  return Array.isArray(connection) ? connection[0] : connection;
}

function schemaFeatures(node: SchemaChild | SchemaSourceConnection | undefined): [string, string][] {
  const feature: SchemaFeature | SchemaFeature[] | undefined = node?.feature;
  return (Array.isArray(feature) ? feature : feature ? [feature] : []).map(f => [f['@_name'], f['@_value']]);
}

describe('diagram object features', () => {
  it('should load style features into typed properties', async () => {
    const archimate = await parseFile('tests/fixtures/roundtrip/diagram-features.archimate');
    const customer = viewChildren(archimate, 'id-view-styled').find(child => child.id === 'id-dmo-customer');

    expect(customer).toMatchObject({
      iconColor: '#ff0000',
      lineAlpha: 128,
      gradient: 2,
      iconVisible: 2,
      deriveElementLineColor: false,
      lineStyle: 1,
    });
    expect(customer?.features?.get('custom')).toBe('kept');
  });

  it('should write typed properties set in code as features, not attributes', async () => {
    const archimate = await parseFile('tests/fixtures/roundtrip/diagram-features.archimate');
    const insurant = viewChildren(archimate, 'id-view-styled').find(child => child.id === 'id-dmo-insurant')!;
    insurant.lineAlpha = 64;
    insurant.iconColor = '#00ff00';
    insurant.deriveElementLineColor = false;

    const saved = schemaChild(archimate, 'id-view-styled', 'id-dmo-insurant');
    expect(saved).not.toHaveProperty('@_lineAlpha');
    expect(saved).not.toHaveProperty('@_iconColor');
    expect(schemaFeatures(saved)).toEqual([
      ['lineAlpha', '64'],
      ['iconColor', '#00ff00'],
      ['deriveElementLineColor', 'false'],
    ]);
  });

  it('should keep the feature order when a typed property changes or is cleared', async () => {
    const archimate = await parseFile('tests/fixtures/roundtrip/diagram-features.archimate');
    const customer = viewChildren(archimate, 'id-view-styled').find(child => child.id === 'id-dmo-customer')!;
    customer.lineAlpha = 200;
    delete customer.gradient;

    expect(schemaFeatures(schemaChild(archimate, 'id-view-styled', 'id-dmo-customer'))).toEqual([
      ['iconColor', '#ff0000'],
      ['custom', 'kept'],
      ['lineAlpha', '200'],
      ['iconVisible', '2'],
      ['deriveElementLineColor', 'false'],
      ['lineStyle', '1'],
    ]);
  });
});

describe('view connection features', () => {
  it('should load nameVisible and textRelativePosition into typed properties', async () => {
    const archimate = await parseFile('tests/fixtures/roundtrip/diagram-features.archimate');
    const connection = viewConnection(archimate, 'id-view-styled', 'id-dmo-customer');

    expect(connection).toMatchObject({ nameVisible: false, textRelativePosition: 4 });
    expect(connection.features?.get('custom')).toBe('kept');
  });

  it('should leave the typed properties unset when the features are absent', async () => {
    const archimate = await parseFile('tests/fixtures/roundtrip/diagram-features.archimate');
    const connection = viewConnection(archimate, 'id-view-styled', 'id-dmo-insurant');

    expect(connection).not.toHaveProperty('nameVisible');
    expect(connection).not.toHaveProperty('textRelativePosition');
  });

  it('should write typed properties set in code as features', async () => {
    const archimate = await parseFile('tests/fixtures/roundtrip/diagram-features.archimate');
    const connection = viewConnection(archimate, 'id-view-styled', 'id-dmo-insurant');
    connection.nameVisible = false;
    connection.textRelativePosition = 1;

    const saved = schemaConnection(archimate, 'id-view-styled', 'id-dmo-insurant');
    expect(saved).not.toHaveProperty('@_nameVisible');
    expect(saved).not.toHaveProperty('@_textRelativePosition');
    expect(schemaFeatures(saved)).toEqual([
      ['nameVisible', 'false'],
      ['textRelativePosition', '1'],
    ]);
  });

  it('should keep the feature order when a typed property changes or is cleared', async () => {
    const archimate = await parseFile('tests/fixtures/roundtrip/diagram-features.archimate');
    const connection = viewConnection(archimate, 'id-view-styled', 'id-dmo-customer');
    connection.textRelativePosition = 16;
    delete connection.nameVisible;

    expect(schemaFeatures(schemaConnection(archimate, 'id-view-styled', 'id-dmo-customer'))).toEqual([
      ['textRelativePosition', '16'],
      ['custom', 'kept'],
    ]);
  });
});
