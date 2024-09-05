import { XMLParser, XMLBuilder, XMLValidator, XmlBuilderOptions } from 'fast-xml-parser'
import { Archimate } from './Archimate.mjs'
import { readFile, writeFile } from 'fs/promises';
import { inspect } from 'util';
import { PathLike } from 'fs';

export class TsArchi {
  model: Archimate

  constructor() {
    this.model = new Archimate()
  }

  async load(path: PathLike): Promise<object> {
    const data = await readFile(path, 'utf8')
    if (XMLValidator.validate(data)) {
      const parseOptions = {
        ignoreAttributes: false,
        allowBooleanAttributes: true
      }
      const o = new XMLParser(parseOptions).parse(data);
      return o as object;
    } else {
      return {}
    }
  }

  async loadModel() {
    const data = await this.load('test.archimate');
    await this.model.load(data)
    return this.model
  }

  async saveModel() {
    const out = this.model.store()
    await this.save('out.archimate', out);
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

const tsa = new TsArchi()
await tsa.loadModel()
await tsa.saveModel()
//console.log(inspect(json, false, null, true))


