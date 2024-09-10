import { Model } from './interfaces/Model.mjs';
import { Schema as ArchimateSchema } from './interfaces/schema/Schema.mjs';
import { Parser } from './Parser.mjs'
import { Serializer } from './Serializer.mjs'



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

export class Archimate {

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

  public parse(input: object) {
    const parser = new Parser(this.model)
    this.name = (input as ArchimateSchema)['archimate:model']?.['@_name'] || 'Unnamed Model';
    this.model = parser.parse(input)
  }

  public serialize(): object {
    const serializer = new Serializer(this.model)
    return serializer.serialize(this.name)
  }

}
