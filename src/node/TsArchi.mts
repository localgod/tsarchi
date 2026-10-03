import { Archimate } from '../Archimate.mjs';
import { readFile, writeFile } from 'fs/promises';
import type { PathLike } from 'fs';
import type { Schema } from '../interfaces/schema/Schema.mjs';
import { parseArchimateXml, buildArchimateXml } from '../internal/Xml.mjs';

export class TsArchi {
  private model: Archimate;

  constructor() {
    this.model = new Archimate();
  }

  /**
   * Reads an .archimate file into its schema shape.
   * Throws an ArchimateParseError when the file is not an Archi model, and the read error when it cannot be read.
   */
  async load(path: PathLike): Promise<Schema> {
    return parseArchimateXml(await readFile(path, 'utf8'));
  }

  /**
   * Loads an .archimate file as the current model. See Archimate.fromXml for the errors it throws.
   */
  async loadModel(path: PathLike): Promise<Archimate> {
    this.model = Archimate.fromXml(await readFile(path, 'utf8'));
    return this.model;
  }

  /**
   * Saves the current model. Throws an ArchimateValidationError if validateModel finds errors.
   */
  async saveModel(path: PathLike) {
    await writeFile(path, this.model.toXml(), 'utf8');
  }

  public getModel(): Archimate {
    return this.model;
  }

  async save(path: PathLike, json: object) {
    await writeFile(path, buildArchimateXml(json), 'utf8');
  }
}
