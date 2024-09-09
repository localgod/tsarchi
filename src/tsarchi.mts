import { Command } from 'commander';
import { XMLParser, XMLBuilder, XMLValidator, XmlBuilderOptions } from 'fast-xml-parser'
import { Archimate } from './Archimate.mjs'
import { readFile, writeFile } from 'fs/promises';
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

  async loadModel(path:PathLike) {
    const data = await this.load(path);
    this.model.parse(data)
    return this.model
  }

  async saveModel(path:PathLike) {
    const out = this.model.serialize()
    await this.save(path, out);
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

const program = new Command()
program.name('sync')
program.description('Parse mood to archi import files');
program.requiredOption('--input <path>', 'path to input file');
program.requiredOption('--output <path>', 'path to output file');
program.action(async (options: { input: string, output: string  }) => {
  const tsa = new TsArchi()
  await tsa.loadModel(options.input)
  await tsa.saveModel(options.output)
})
program.parse()





