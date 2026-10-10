import { Archimate } from '../Archimate.mjs';
import { readFile, writeFile } from 'fs/promises';
import type { PathLike } from 'fs';

export class TsArchi {
  private model: Archimate;

  constructor() {
    this.model = new Archimate();
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
}
