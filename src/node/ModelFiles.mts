import { Archimate } from '../Archimate.mjs';
import { readFile, writeFile } from 'fs/promises';
import type { PathLike } from 'fs';

/**
 * Loads an .archimate file. Throws what Archimate.fromXml throws for its text, and passes on file read errors.
 */
export async function loadModel(path: PathLike): Promise<Archimate> {
  return Archimate.fromXml(await readFile(path, 'utf8'));
}

/**
 * Saves a model as an .archimate file. Throws an ArchimateValidationError, without writing, if validateModel finds
 * errors.
 */
export async function saveModel(model: Archimate, path: PathLike): Promise<void> {
  await writeFile(path, model.toXml(), 'utf8');
}

/**
 * Loads a model saved with `saveModelJson`. Throws what Archimate.fromJson throws for its text, and passes on file
 * read errors.
 */
export async function loadModelJson(path: PathLike): Promise<Archimate> {
  return Archimate.fromJson(await readFile(path, 'utf8'));
}

/**
 * Saves a model in tsarchi's JSON format (see Archimate.toJson). Throws, without writing, what toJson throws.
 */
export async function saveModelJson(model: Archimate, path: PathLike): Promise<void> {
  await writeFile(path, model.toJson(), 'utf8');
}
