import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser'
import type { XmlBuilderOptions } from 'fast-xml-parser'
import { Archimate } from './Archimate.mjs'
import { readFile, writeFile } from 'fs/promises';
import type { PathLike } from 'fs';
import type { Schema } from './interfaces/schema/Schema.mjs';

export class TsArchi {
  private model: Archimate

  constructor() {
    this.model = new Archimate()
  }

  async load(path: PathLike): Promise<Schema|object> {
    try {
      const data = await readFile(path, 'utf8');

      if (!XMLValidator.validate(data)) {
        return {};
      }

      const parseOptions = {
        ignoreAttributes: false,
        allowBooleanAttributes: true
      };

      const parsedObject = new XMLParser(parseOptions).parse(data);

      if (parsedObject && parsedObject['archimate:model']) {
        return parsedObject as Schema;
      } else {
        return {};
      }
    } catch (error) {
      console.error('Error loading or parsing XML file:', error);
      return {};
    }
  }

  async loadModel(path: PathLike) {
    const data = await this.load(path);
    if (data && typeof data === 'object' && 'archimate:model' in data) {
      this.model.parse(data as Schema);
    } else {
      console.warn('Invalid or empty Archimate model data. Using empty model.');
    }
    return this.model;
  }

  async saveModel(path: PathLike) {
    const out = this.model.serialize()
    await this.save(path, out);
  }

  public getModel(): Archimate {
    return this.model
  }

  async save(path: PathLike, json: object) {
    const buildOptions: XmlBuilderOptions = {
      ignoreAttributes: false,
      format: true,
      suppressEmptyNode: true,
      suppressBooleanAttributes: false
    };

    const builder = new XMLBuilder(buildOptions);
    const out = builder.build(json);
    await writeFile(path, out, 'utf8');
  }
}
