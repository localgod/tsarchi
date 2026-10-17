import type { Element } from '../interfaces/Element.mjs';
import type { View, ViewConnection } from '../interfaces/View.mjs';
import type { ViewChild } from '../interfaces/ViewChild.mjs';
import type { DrawioOptions } from '../interfaces/DrawioOptions.mjs';
import { AccessType, TextAlignment, TextPosition } from '../constants/archi-codes.mjs';

/** Looks up an element, relationship or view of the model by id. */
export type ConceptLookup = (id: string) => Element | undefined;

type Point = { x: number; y: number };
type Box = Point & { width: number; height: number };

/** Archi's fill per element type group, used where a diagram object stores none. */
const layerFills: ReadonlyArray<[string, readonly string[]]> = [
  ['#f5deaa', ['Capability', 'CourseOfAction', 'Resource', 'ValueStream']],
  [
    '#ffffb5',
    [
      'BusinessActor',
      'BusinessRole',
      'BusinessCollaboration',
      'BusinessInterface',
      'BusinessProcess',
      'BusinessFunction',
      'BusinessInteraction',
      'BusinessService',
      'BusinessEvent',
      'BusinessObject',
      'Contract',
      'Representation',
      'Product',
    ],
  ],
  [
    '#b5ffff',
    [
      'ApplicationComponent',
      'ApplicationCollaboration',
      'ApplicationInterface',
      'ApplicationProcess',
      'ApplicationFunction',
      'ApplicationInteraction',
      'ApplicationEvent',
      'ApplicationService',
      'DataObject',
    ],
  ],
  [
    '#c9e7b7',
    [
      'Node',
      'Device',
      'SystemSoftware',
      'TechnologyCollaboration',
      'TechnologyInterface',
      'TechnologyProcess',
      'TechnologyFunction',
      'TechnologyInteraction',
      'TechnologyService',
      'CommunicationNetwork',
      'Path',
      'Artifact',
      'TechnologyEvent',
      'Equipment',
      'Facility',
      'DistributionNetwork',
      'Material',
    ],
  ],
  ['#ccccff', ['Stakeholder', 'Driver', 'Assessment', 'Goal', 'Outcome', 'Principle', 'Requirement', 'Constraint', 'Meaning', 'Value']],
  ['#ffe0e0', ['WorkPackage', 'Deliverable', 'ImplementationEvent']],
  ['#e0ffe0', ['Plateau', 'Gap']],
  ['#fbb875', ['Location']],
];
const defaultFills = new Map(layerFills.flatMap(([fill, types]) => types.map(type => [type, fill] as const)));

/**
 * draw.io's ArchiMate 3 shape for each element type, as `appType` and `archiType` of `mxgraph.archimate3.application`:
 * the rectangle notation with the type's icon in the corner, as draw.io's ArchiMate 3.2 palette draws it.
 */
const stencils: Readonly<Record<string, [appType: string, archiType?: string]>> = {
  Capability: ['capability', 'rounded'],
  CourseOfAction: ['course', 'rounded'],
  Resource: ['resource', 'square'],
  ValueStream: ['valueStream', 'rounded'],
  BusinessActor: ['actor', 'square'],
  BusinessRole: ['role', 'square'],
  BusinessCollaboration: ['collab', 'square'],
  BusinessInterface: ['interface', 'square'],
  BusinessProcess: ['proc', 'rounded'],
  BusinessFunction: ['func', 'rounded'],
  BusinessInteraction: ['interaction', 'rounded'],
  BusinessService: ['serv', 'rounded'],
  BusinessEvent: ['event', 'rounded'],
  BusinessObject: ['passive', 'square'],
  Contract: ['contract', 'square'],
  Representation: ['representation', 'square'],
  Product: ['product', 'square'],
  ApplicationComponent: ['comp', 'square'],
  ApplicationCollaboration: ['collab', 'square'],
  ApplicationInterface: ['interface', 'square'],
  ApplicationProcess: ['proc', 'rounded'],
  ApplicationFunction: ['func', 'rounded'],
  ApplicationInteraction: ['interaction', 'rounded'],
  ApplicationEvent: ['event', 'rounded'],
  ApplicationService: ['serv', 'rounded'],
  DataObject: ['passive', 'square'],
  Node: ['node', 'square'],
  Device: ['device'],
  SystemSoftware: ['sysSw', 'square'],
  TechnologyCollaboration: ['collab', 'square'],
  TechnologyInterface: ['interface', 'square'],
  TechnologyProcess: ['proc', 'rounded'],
  TechnologyFunction: ['func', 'rounded'],
  TechnologyInteraction: ['interaction', 'rounded'],
  TechnologyService: ['serv', 'rounded'],
  TechnologyEvent: ['event', 'rounded'],
  CommunicationNetwork: ['netw', 'square'],
  Path: ['path', 'square'],
  Artifact: ['artifact', 'square'],
  Equipment: ['equipment', 'square'],
  Facility: ['facility', 'square'],
  DistributionNetwork: ['distribution', 'square'],
  Material: ['material', 'square'],
  Stakeholder: ['role', 'oct'],
  Driver: ['driver', 'oct'],
  Assessment: ['assess', 'oct'],
  Goal: ['goal', 'oct'],
  Outcome: ['outcome', 'oct'],
  Principle: ['principle', 'oct'],
  Requirement: ['requirement', 'oct'],
  Constraint: ['constraint', 'oct'],
  Meaning: ['meaning', 'oct'],
  Value: ['amValue', 'oct'],
  WorkPackage: ['workPackage', 'rounded'],
  Deliverable: ['deliverable'],
  ImplementationEvent: ['event', 'rounded'],
  Plateau: ['plateau'],
  Gap: ['gap'],
  Location: ['location', 'square'],
  Grouping: ['grouping', 'square'],
};

/** The line and arrow style of each relationship type, as draw.io's ArchiMate 3.2 palette draws it. */
const relationshipStyles: Readonly<Record<string, string>> = {
  CompositionRelationship: 'startArrow=diamondThin;startFill=1;startSize=10;endArrow=none;endFill=0',
  AggregationRelationship: 'startArrow=diamondThin;startFill=0;startSize=10;endArrow=none;endFill=0',
  AssignmentRelationship: 'startArrow=oval;startFill=1;endArrow=block;endFill=1',
  RealizationRelationship: 'endArrow=block;endFill=0;dashed=1',
  ServingRelationship: 'endArrow=open;endFill=1',
  InfluenceRelationship: 'endArrow=open;endFill=0;dashed=1;dashPattern=6 4',
  TriggeringRelationship: 'endArrow=block;endFill=1',
  FlowRelationship: 'endArrow=block;endFill=1;dashed=1;dashPattern=6 4',
  SpecializationRelationship: 'endArrow=block;endFill=0',
};

function relationshipStyle(relationship: Element | undefined): string {
  if (!relationship) return 'endArrow=none';
  switch (relationship.type) {
    case 'AccessRelationship': {
      const access = 'dashed=1;dashPattern=1 4';
      switch (relationship.accessType ?? AccessType.Write) {
        case AccessType.Read:
          return `${access};startArrow=open;startFill=0;endArrow=none`;
        case AccessType.Unspecified:
          return `${access};endArrow=none`;
        case AccessType.ReadWrite:
          return `${access};startArrow=open;startFill=0;endArrow=open;endFill=0`;
        default:
          return `${access};endArrow=open;endFill=0`;
      }
    }
    case 'AssociationRelationship':
      return relationship.directed ? 'endArrow=openAsync;endFill=0' : 'endArrow=none';
    default:
      return relationshipStyles[relationship.type] ?? 'endArrow=none';
  }
}

/** Archi's default size of a diagram object that stores none (`-1`). */
function defaultSize(child: ViewChild, concept: Element | undefined): [number, number] {
  if (concept?.type === 'Junction') return [15, 15];
  switch (child.type) {
    case 'Group':
      return [400, 140];
    case 'Note':
      return [185, 80];
    default:
      return [120, 55];
  }
}

const horizontal: Readonly<Record<number, string>> = {
  [TextAlignment.Left]: 'left',
  [TextAlignment.Center]: 'center',
  [TextAlignment.Right]: 'right',
};
const vertical: Readonly<Record<number, string>> = {
  [TextPosition.Top]: 'top',
  [TextPosition.Center]: 'middle',
  [TextPosition.Bottom]: 'bottom',
};

/** A style value: draw.io separates entries with `;` and keys from values with `=`. */
const styleValue = (value: string) => value.replace(/[;=]/g, '');

/**
 * The font of an Archi font string, SWT's `FontData` (`1|name|height|style|…`, style 1 bold and 2 italic), as
 * draw.io style entries. draw.io sizes fonts in pixels, so points are converted at 96 dpi.
 */
function fontStyle(font: string | undefined): string[] {
  const parts = font?.split('|') ?? [];
  if (parts.length < 4) return [];
  const entries: string[] = [];
  if (parts[1]) entries.push(`fontFamily=${styleValue(parts[1])}`);
  const points = Number(parts[2]);
  if (points > 0) entries.push(`fontSize=${Math.round((points * 4) / 3)}`);
  const style = Number(parts[3]) & 3;
  if (style) entries.push(`fontStyle=${style}`);
  return entries;
}

const xmlCharacters: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\t': '&#x9;',
  '\n': '&#xA;',
  '\r': '&#xD;',
};
const xmlAttribute = (value: string) => value.replace(/[&<>"\t\n\r]/g, character => xmlCharacters[character]);

/** A label for a cell with `html=1`: the text as HTML, with line breaks kept. */
const htmlLabel = (text: string) => text.replace(/[&<>"]/g, character => xmlCharacters[character]).replace(/\r\n?|\n/g, '<br>');

const round = (value: number) => Math.round(value * 100) / 100;
const opacity = (alpha: number) => Math.round((Math.min(Math.max(alpha, 0), 255) / 255) * 100);

interface Cell {
  id: string;
  parent: string;
  value: string;
  style: string;
  /** Vertex geometry, relative to the parent cell. */
  box?: Box;
  edge?: { source: string; target: string; points: Point[] };
}

class DrawioWriter {
  private readonly cells: Cell[] = [];
  private readonly edges: Cell[] = [];
  /** Absolute bounds of each diagram child. */
  private readonly boxes = new Map<string, Box>();
  private readonly connections = new Map<string, ViewConnection>();
  /** Midpoints of connections that other connections end on. */
  private readonly midpoints = new Map<string, Point>();

  constructor(
    private readonly view: View,
    private readonly lookup: ConceptLookup,
    private readonly options: DrawioOptions,
    private readonly rootId: string,
    private readonly layerId: string
  ) {}

  write(): string {
    for (const child of this.view.children) this.addChild(child, this.layerId, { x: 0, y: 0 });
    for (const connection of this.connections.values()) this.addConnection(connection);

    const lines = [
      `<mxfile host="tsarchi" type="device">`,
      `  <diagram id="${xmlAttribute(this.view.id)}" name="${xmlAttribute(this.view.name)}">`,
      `    <mxGraphModel grid="1" gridSize="12" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" math="0" shadow="0">`,
      `      <root>`,
      `        <mxCell id="${xmlAttribute(this.rootId)}"/>`,
      `        <mxCell id="${xmlAttribute(this.layerId)}" parent="${xmlAttribute(this.rootId)}"/>`,
      ...[...this.cells, ...this.edges].map(cell => `        ${this.cellXml(cell)}`),
      `      </root>`,
      `    </mxGraphModel>`,
      `  </diagram>`,
      `</mxfile>`,
    ];
    return lines.join('\n') + '\n';
  }

  private addChild(child: ViewChild, parent: string, origin: Point): void {
    const concept = child.archimateElement ? this.lookup(child.archimateElement) : undefined;
    const [defaultWidth, defaultHeight] = defaultSize(child, concept);
    const box: Box = {
      x: child.bounds.x,
      y: child.bounds.y,
      width: child.bounds.width > 0 ? child.bounds.width : defaultWidth,
      height: child.bounds.height > 0 ? child.bounds.height : defaultHeight,
    };
    this.boxes.set(child.id, { ...box, x: origin.x + box.x, y: origin.y + box.y });
    this.cells.push({ id: child.id, parent, value: htmlLabel(this.label(child, concept)), style: this.vertexStyle(child, concept), box });

    for (const connection of child.sourceConnections) this.collectConnection(connection);
    for (const nested of child.children) this.addChild(nested, child.id, { x: origin.x + box.x, y: origin.y + box.y });
  }

  private collectConnection(connection: ViewConnection): void {
    this.connections.set(connection.id, connection);
    for (const nested of connection.sourceConnections) this.collectConnection(nested);
  }

  private label(child: ViewChild, concept: Element | undefined): string {
    switch (child.type) {
      case 'DiagramObject':
        return concept?.type === 'Junction' ? '' : (concept?.name ?? child.name ?? '');
      case 'Note':
        return child.content ?? '';
      case 'DiagramModelReference':
        return (child.model ? this.lookup(child.model)?.name : undefined) ?? child.name ?? '';
      default:
        return child.name ?? child.content ?? '';
    }
  }

  private vertexStyle(child: ViewChild, concept: Element | undefined): string {
    const type = concept?.type;
    const entries: string[] = [];
    let fill = child.fillColor;

    if (type === 'Junction') {
      entries.push('ellipse', 'html=1', 'aspect=fixed');
      fill ??= concept?.junctionType === 'or' ? '#ffffff' : '#000000';
    } else {
      const stencil = this.options.stencils && type ? stencils[type] : undefined;
      if (stencil) {
        entries.push('html=1', 'outlineConnect=0', 'whiteSpace=wrap', 'shape=mxgraph.archimate3.application', `appType=${stencil[0]}`);
        if (stencil[1]) entries.push(`archiType=${stencil[1]}`);
      } else {
        entries.push('rounded=0', 'whiteSpace=wrap', 'html=1');
      }
      if (type === 'Grouping') entries.push('dashed=1');

      switch (child.type) {
        case 'DiagramObject':
          fill ??= type === 'Grouping' ? 'none' : (defaultFills.get(type ?? '') ?? '#e8e8e8');
          break;
        case 'Group':
          fill ??= '#d2d7d7';
          break;
        case 'Note':
          fill ??= '#ffffff';
          break;
        case 'DiagramModelReference':
          fill ??= '#dcebeb';
          break;
      }
      const defaultAlignment = child.type === 'Group' || type === 'Grouping' ? TextAlignment.Left : TextAlignment.Center;
      entries.push(`align=${horizontal[child.textAlignment ?? defaultAlignment] ?? 'center'}`);
      entries.push(`verticalAlign=${vertical[child.textPosition ?? TextPosition.Top] ?? 'top'}`);
      if (child.type === 'Note' || child.type === 'Group' || type === 'Grouping') entries.push('spacingLeft=4');
    }

    if (fill) entries.push(`fillColor=${styleValue(fill)}`);
    if (child.alpha !== undefined) entries.push(`fillOpacity=${opacity(child.alpha)}`);
    if (child.lineColor) entries.push(`strokeColor=${styleValue(child.lineColor)}`);
    if (child.lineAlpha !== undefined) entries.push(`strokeOpacity=${opacity(child.lineAlpha)}`);
    if (child.lineWidth !== undefined) entries.push(`strokeWidth=${child.lineWidth}`);
    if (child.fontColor) entries.push(`fontColor=${styleValue(child.fontColor)}`);
    entries.push(...fontStyle(child.font));
    if (child.children.length > 0) entries.push('container=1', 'collapsible=0');
    return entries.join(';') + ';';
  }

  private addConnection(connection: ViewConnection): void {
    const relationship = connection.archimateRelationship ? this.lookup(connection.archimateRelationship) : undefined;
    const name = connection.nameVisible === false ? '' : (relationship?.name ?? connection.name ?? '');
    const entries = ['html=1', 'rounded=0', 'endSize=8', relationshipStyle(relationship)];
    if (connection.lineColor) entries.push(`strokeColor=${styleValue(connection.lineColor)}`);
    if (connection.lineWidth !== undefined) entries.push(`strokeWidth=${connection.lineWidth}`);
    if (connection.fontColor) entries.push(`fontColor=${styleValue(connection.fontColor)}`);
    entries.push(...fontStyle(connection.font));

    this.edges.push({
      id: connection.id,
      parent: this.layerId,
      value: htmlLabel(name),
      style: entries.join(';') + ';',
      edge: { source: connection.source, target: connection.target, points: this.bendpoints(connection) },
    });
  }

  private bendpoints(connection: ViewConnection): Point[] {
    if (!connection.bendpoints?.length) return [];
    const source = this.centre(connection.source);
    const target = this.centre(connection.target);
    if (!source || !target) return [];
    return bendpointPositions(connection, source, target).map(p => ({ x: round(p.x), y: round(p.y) }));
  }

  /** The centre of a diagram child, or the midpoint of a connection's line when a connection ends on another. */
  private centre(id: string, visiting = new Set<string>()): Point | undefined {
    const box = this.boxes.get(id);
    if (box) return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const cached = this.midpoints.get(id);
    if (cached) return cached;
    const connection = this.connections.get(id);
    if (!connection || visiting.has(id)) return undefined;
    visiting.add(id);
    const source = this.centre(connection.source, visiting);
    const target = this.centre(connection.target, visiting);
    if (!source || !target) return undefined;
    const points = [source, ...bendpointPositions(connection, source, target), target];
    const midpoint = polylineMidpoint(points);
    this.midpoints.set(id, midpoint);
    return midpoint;
  }

  private cellXml(cell: Cell): string {
    const attributes = [
      `id="${xmlAttribute(cell.id)}"`,
      `value="${xmlAttribute(cell.value)}"`,
      `style="${xmlAttribute(cell.style)}"`,
      cell.edge ? 'edge="1"' : 'vertex="1"',
      `parent="${xmlAttribute(cell.parent)}"`,
    ];
    if (cell.edge) {
      attributes.push(`source="${xmlAttribute(cell.edge.source)}"`, `target="${xmlAttribute(cell.edge.target)}"`);
      const points = cell.edge.points;
      if (points.length === 0) return `<mxCell ${attributes.join(' ')}><mxGeometry relative="1" as="geometry"/></mxCell>`;
      const array = points.map(p => `<mxPoint x="${p.x}" y="${p.y}"/>`).join('');
      return `<mxCell ${attributes.join(' ')}><mxGeometry relative="1" as="geometry"><Array as="points">${array}</Array></mxGeometry></mxCell>`;
    }
    const { x, y, width, height } = cell.box!;
    return `<mxCell ${attributes.join(' ')}><mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/></mxCell>`;
  }
}

/** Archi stores bendpoint `i` of `n` as offsets from both ends' centres, weighted `(i + 1) / (n + 1)` to the target. */
function bendpointPositions(connection: ViewConnection, source: Point, target: Point): Point[] {
  const list = connection.bendpoints ?? [];
  return list.map((b, i) => {
    const weight = (i + 1) / (list.length + 1);
    return {
      x: (1 - weight) * (source.x + b.startX) + weight * (target.x + b.endX),
      y: (1 - weight) * (source.y + b.startY) + weight * (target.y + b.endY),
    };
  });
}

function polylineMidpoint(points: Point[]): Point {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let remaining = lengths.reduce((sum, length) => sum + length, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] && lengths[i] > 0) {
      const t = remaining / lengths[i];
      return { x: points[i].x + t * (points[i + 1].x - points[i].x), y: points[i].y + t * (points[i + 1].y - points[i].y) };
    }
    remaining -= lengths[i];
  }
  return points[0];
}

/**
 * Writes a view as a draw.io file (mxGraph XML): diagram objects, groups and notes as vertices with their bounds,
 * nested children inside their parent, and connections as edges with their bendpoints.
 */
export function serializeDrawio(view: View, lookup: ConceptLookup, options: DrawioOptions = {}, usedIds: (id: string) => boolean): string {
  const freeId = (base: string) => {
    let id = base;
    for (let n = 1; usedIds(id); n++) id = `${base}-${n}`;
    return id;
  };
  return new DrawioWriter(view, lookup, options, freeId(`${view.id}-root`), freeId(`${view.id}-layer`)).write();
}
