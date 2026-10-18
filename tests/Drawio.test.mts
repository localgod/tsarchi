import { describe, it, expect } from 'vite-plus/test';
import { readFileSync, readdirSync } from 'fs';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { Archimate } from '../src/Archimate.mjs';
import {
  archimateApplicationElementTypes,
  archimateBusinessElementTypes,
  archimateImplementationMigrationElementTypes,
  archimateMotivationElementTypes,
  archimateOtherElementTypes,
  archimateStrategyElementTypes,
  archimateTechnologyElementTypes,
} from '../src/constants/archimate-mappings.mjs';

interface DrawioCell {
  '@_id': string;
  '@_value'?: string;
  '@_style'?: string;
  '@_vertex'?: string;
  '@_edge'?: string;
  '@_parent'?: string;
  '@_source'?: string;
  '@_target'?: string;
  mxGeometry?: {
    '@_x'?: string;
    '@_y'?: string;
    '@_width'?: string;
    '@_height'?: string;
    Array?: { mxPoint: { '@_x': string; '@_y': string } | { '@_x': string; '@_y': string }[] };
  };
}

/** The cells of a draw.io file by id, with their attribute values decoded. */
function cells(xml: string): Map<string, DrawioCell> {
  expect(XMLValidator.validate(xml)).toBe(true);
  const parsed = new XMLParser({ ignoreAttributes: false, isArray: name => name === 'mxCell' || name === 'mxPoint' }).parse(xml);
  const list: DrawioCell[] = parsed.mxfile.diagram.mxGraphModel.root.mxCell;
  return new Map(list.map(cell => [cell['@_id'], cell]));
}

const style = (cell: DrawioCell | undefined) =>
  new Map(
    (cell?.['@_style'] ?? '')
      .split(';')
      .filter(Boolean)
      .map(entry => entry.split('=') as [string, string?])
  );
const points = (cell: DrawioCell | undefined) => {
  const list = cell?.mxGeometry?.Array?.mxPoint ?? [];
  return (Array.isArray(list) ? list : [list]).map(p => [Number(p['@_x']), Number(p['@_y'])]);
};

const fixture = (path: string) => Archimate.fromXml(readFileSync(new URL(`./fixtures/${path}`, import.meta.url), 'utf8'));

const model = (view: string, elements = '', relations = '') => `<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="drawio" id="id-model" version="5.0.0">
  <folder name="Business" id="id-business" type="business">${elements}</folder>
  <folder name="Relations" id="id-relations" type="relations">${relations}</folder>
  <folder name="Views" id="id-views" type="diagrams">
    <element xsi:type="archimate:ArchimateDiagramModel" name="View &amp; more" id="id-view">${view}</element>
  </folder>
</archimate:model>`;

describe('toDrawio', () => {
  it('writes one page named after the view, with the root and layer cells first', () => {
    const xml = fixture('roundtrip/connection-to-connection.archimate').toDrawio('id-c2c-view');
    const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml);
    expect(parsed.mxfile.diagram['@_name']).toBe('Connection View');
    expect(parsed.mxfile.diagram['@_id']).toBe('id-c2c-view');
    const [root, layer] = [...cells(xml).values()];
    expect(root).toMatchObject({ '@_id': 'id-c2c-view-root' });
    expect(layer).toMatchObject({ '@_id': 'id-c2c-view-layer', '@_parent': 'id-c2c-view-root' });
  });

  it('writes diagram objects as vertices with their bounds and the element name', () => {
    const result = cells(fixture('roundtrip/connection-to-connection.archimate').toDrawio('id-c2c-view'));
    expect(result.get('id-clerk-object')).toMatchObject({
      '@_value': 'Clerk',
      '@_vertex': '1',
      '@_parent': 'id-c2c-view-layer',
      mxGeometry: { '@_x': '40', '@_y': '40', '@_width': '120', '@_height': '55' },
    });
    expect(style(result.get('id-clerk-object')).get('fillColor')).toBe('#ffffb5');
  });

  it('writes nested children inside their parent, with bounds relative to it', () => {
    const archimate = fixture('archi/Archisurance.archimate');
    const view = archimate.listViews().find(v => v.children.some(c => c.type === 'Group' && c.children.length > 0))!;
    const group = view.children.find(c => c.type === 'Group' && c.children.length > 0)!;
    const nested = group.children[0];
    const result = cells(archimate.toDrawio(view.id));
    expect(style(result.get(group.id)).get('container')).toBe('1');
    expect(result.get(nested.id)).toMatchObject({
      '@_parent': group.id,
      mxGeometry: { '@_x': String(nested.bounds.x), '@_y': String(nested.bounds.y) },
    });
  });

  it("uses Archi's default sizes where a diagram object stores none", () => {
    const result = cells(fixture('roundtrip/default-bounds.archimate').toDrawio('id-default-bounds-view'));
    expect(result.get('id-default-size-object')?.mxGeometry).toMatchObject({
      '@_x': '240',
      '@_y': '12',
      '@_width': '120',
      '@_height': '55',
    });
    expect(result.get('id-default-group')?.mxGeometry).toMatchObject({ '@_x': '0', '@_y': '0', '@_width': '400', '@_height': '140' });
    expect(result.get('id-origin-note')).toMatchObject({ '@_value': 'This note sits at x, y 0.' });
    expect(style(result.get('id-origin-note')).get('align')).toBe('left');
  });

  it('writes connections as edges after every vertex, between their diagram objects', () => {
    const xml = fixture('roundtrip/connection-to-connection.archimate').toDrawio('id-c2c-view');
    const list = [...cells(xml).values()];
    const firstEdge = list.findIndex(cell => cell['@_edge'] === '1');
    expect(list.slice(firstEdge).every(cell => cell['@_edge'] === '1')).toBe(true);
    expect(cells(xml).get('id-assignment-connection')).toMatchObject({
      '@_value': 'assigned',
      '@_source': 'id-clerk-object',
      '@_target': 'id-cashier-object',
      '@_parent': 'id-c2c-view-layer',
    });
  });

  it('places bendpoints at their absolute position, as Archi computes them from both centres', () => {
    const result = cells(fixture('roundtrip/connection-to-connection.archimate').toDrawio('id-c2c-view'));
    // Clerk's centre is (100, 67.5), Cashier's (340, 67.5); one bendpoint is weighted 1/2.
    expect(points(result.get('id-assignment-connection'))).toEqual([[220, 87.5]]);
  });

  it('connects connections that end on other connections', () => {
    const result = cells(fixture('roundtrip/connection-to-connection.archimate').toDrawio('id-c2c-view'));
    expect(result.get('id-contract-connection')).toMatchObject({
      '@_source': 'id-contract-object',
      '@_target': 'id-assignment-connection',
    });
    expect(result.get('id-assignment-association-connection')).toMatchObject({
      '@_source': 'id-assignment-connection',
      '@_target': 'id-contract-object',
    });
  });

  it('draws each relationship with its ArchiMate line and arrows', () => {
    const relations = [
      ['Composition', ''],
      ['Serving', ''],
      ['Access', 'accessType="1"'],
      ['Access', 'accessType="3"'],
      ['Association', 'directed="true"'],
    ]
      .map(([type, extra], i) => `<element xsi:type="archimate:${type}Relationship" id="id-r${i}" source="id-a" target="id-b" ${extra}/>`)
      .join('');
    const connections = [0, 1, 2, 3, 4]
      .map(
        i =>
          `<sourceConnection xsi:type="archimate:Connection" id="id-c${i}" source="id-a-object" target="id-b-object" archimateRelationship="id-r${i}"/>`
      )
      .join('');
    const xml = model(
      `<child xsi:type="archimate:DiagramObject" id="id-a-object" archimateElement="id-a"><bounds x="0" y="0" width="120" height="55"/>${connections}</child>
       <child xsi:type="archimate:DiagramObject" id="id-b-object" archimateElement="id-b"><bounds x="300" y="0" width="120" height="55"/></child>`,
      '<element xsi:type="archimate:BusinessActor" name="A" id="id-a"/><element xsi:type="archimate:BusinessRole" name="B" id="id-b"/>',
      relations
    );
    const result = cells(Archimate.fromXml(xml).toDrawio('id-view'));
    expect(style(result.get('id-c0')).get('startArrow')).toBe('diamondThin');
    expect(style(result.get('id-c0')).get('startFill')).toBe('1');
    expect(style(result.get('id-c1')).get('endArrow')).toBe('open');
    expect(style(result.get('id-c2')).get('startArrow')).toBe('open');
    expect(style(result.get('id-c2')).get('endArrow')).toBe('none');
    expect(style(result.get('id-c3')).get('startArrow')).toBe('open');
    expect(style(result.get('id-c3')).get('endArrow')).toBe('open');
    expect(style(result.get('id-c4')).get('endArrow')).toBe('openAsync');
  });

  it('carries over colours, opacity, line width and font', () => {
    const xml = model(
      `<child xsi:type="archimate:DiagramObject" id="id-a-object" archimateElement="id-a" fillColor="#ff0000" lineColor="#00ff00" fontColor="#0000ff" lineWidth="3" alpha="128" textAlignment="4" textPosition="2" font="1|Arial|12.0|1|WINDOWS|1|0|0|0|0|0|0|0|0|1|0|0|0|0|Arial">
         <bounds x="0" y="0" width="120" height="55"/>
       </child>`,
      '<element xsi:type="archimate:BusinessActor" name="A" id="id-a"/>'
    );
    const entries = style(cells(Archimate.fromXml(xml).toDrawio('id-view')).get('id-a-object'));
    expect(Object.fromEntries(entries)).toMatchObject({
      fillColor: '#ff0000',
      strokeColor: '#00ff00',
      fontColor: '#0000ff',
      strokeWidth: '3',
      fillOpacity: '50',
      align: 'right',
      verticalAlign: 'bottom',
      fontFamily: 'Arial',
      fontSize: '16',
      fontStyle: '1',
    });
  });

  it('escapes names as HTML labels and keeps line breaks', () => {
    const xml = model(
      `<child xsi:type="archimate:Note" id="id-note"><bounds x="0" y="0" width="185" height="80"/><content>a &lt;b&gt; &amp; c&#xD;
second line</content></child>`
    );
    const result = cells(Archimate.fromXml(xml).toDrawio('id-view'));
    expect(result.get('id-note')?.['@_value']).toBe('a &lt;b&gt; &amp; c<br>second line');
  });

  it('draws junctions as small circles, filled for AND and white for OR, without a label', () => {
    const xml = model(
      `<child xsi:type="archimate:DiagramObject" id="id-and-object" archimateElement="id-and"><bounds x="0" y="0"/></child>
       <child xsi:type="archimate:DiagramObject" id="id-or-object" archimateElement="id-or"><bounds x="40" y="0"/></child>`,
      '<element xsi:type="archimate:Junction" name="and" id="id-and"/><element xsi:type="archimate:Junction" name="or" id="id-or" type="or"/>'
    );
    const result = cells(Archimate.fromXml(xml).toDrawio('id-view'));
    expect(style(result.get('id-and-object')).has('ellipse')).toBe(true);
    expect(style(result.get('id-and-object')).get('fillColor')).toBe('#000000');
    expect(style(result.get('id-or-object')).get('fillColor')).toBe('#ffffff');
    expect(result.get('id-and-object')?.mxGeometry).toMatchObject({ '@_width': '15', '@_height': '15' });
    expect(result.get('id-and-object')?.['@_value']).toBe('');
  });

  it('draws plain rectangles unless stencils are asked for', () => {
    const archimate = fixture('roundtrip/connection-to-connection.archimate');
    const plain = cells(archimate.toDrawio('id-c2c-view'));
    expect(style(plain.get('id-clerk-object')).get('shape')).toBeUndefined();
    expect(style(plain.get('id-clerk-object')).get('rounded')).toBe('0');

    const stencils = cells(archimate.toDrawio('id-c2c-view', { stencils: true }));
    expect(Object.fromEntries(style(stencils.get('id-clerk-object')))).toMatchObject({
      shape: 'mxgraph.archimate3.application',
      appType: 'actor',
      archiType: 'square',
      fillColor: '#ffffb5',
    });
    expect(style(stencils.get('id-cashier-object')).get('appType')).toBe('role');
    expect(style(stencils.get('id-contract-object')).get('appType')).toBe('passive');
  });

  it('has a draw.io ArchiMate 3 shape for every element type', () => {
    const types = [
      ...archimateStrategyElementTypes,
      ...archimateBusinessElementTypes,
      ...archimateApplicationElementTypes,
      ...archimateTechnologyElementTypes,
      ...archimateMotivationElementTypes,
      ...archimateImplementationMigrationElementTypes,
      ...archimateOtherElementTypes,
    ];
    const elements = types.map(type => `<element xsi:type="archimate:${type}" name="${type}" id="id-${type}"/>`).join('');
    const children = types
      .map(
        (type, i) =>
          `<child xsi:type="archimate:DiagramObject" id="id-${type}-object" archimateElement="id-${type}"><bounds x="${i * 130}" y="0"/></child>`
      )
      .join('');
    const result = cells(Archimate.fromXml(model(children, elements)).toDrawio('id-view', { stencils: true }));
    for (const type of types) {
      expect(style(result.get(`id-${type}-object`)).get('appType'), type).toBeTruthy();
    }
  });

  it('throws for a view that does not exist', () => {
    expect(() => new Archimate().toDrawio('id-missing')).toThrow('View with ID id-missing not found in model');
  });

  it('writes well-formed draw.io files for every view of every fixture', () => {
    for (const folder of ['archi', 'roundtrip']) {
      for (const file of readdirSync(new URL(`./fixtures/${folder}`, import.meta.url)).filter(name => name.endsWith('.archimate'))) {
        let archimate: Archimate;
        try {
          archimate = fixture(`${folder}/${file}`);
        } catch {
          continue;
        }
        for (const view of archimate.listViews()) {
          for (const stencils of [false, true]) {
            const result = cells(archimate.toDrawio(view.id, { stencils }));
            const ids = new Set(result.keys());
            for (const cell of result.values()) {
              if (cell['@_parent']) expect(ids.has(cell['@_parent']), `${file} ${cell['@_id']}`).toBe(true);
              if (cell['@_source']) expect(ids.has(cell['@_source']), `${file} ${cell['@_id']}`).toBe(true);
              if (cell['@_target']) expect(ids.has(cell['@_target']), `${file} ${cell['@_id']}`).toBe(true);
            }
          }
        }
      }
    }
  });
});
