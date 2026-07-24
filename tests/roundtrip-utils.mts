import { mkdir, mkdtemp, readdir, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, join } from 'path';
import { XMLParser } from 'fast-xml-parser';
import { TsArchi } from '../src/TsArchi.mjs';

export interface RoundtripResult {
  fixturePath: string;
  outputPath: string;
  errors: string[];
}

export function normalizeXml(xml: string): unknown {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true,
    parseTagValue: true,
    allowBooleanAttributes: true
  }).parse(xml);
}

export function compareObjects(input: unknown, output: unknown, path = '', errors: string[] = []): string[] {
  if (typeof input !== typeof output) {
    errors.push(`Type mismatch at ${path}: ${typeof input} vs ${typeof output}`);
    return errors;
  }

  if (input && output && typeof input === 'object') {
    if (Array.isArray(input) || Array.isArray(output)) {
      if (!Array.isArray(input) || !Array.isArray(output)) {
        errors.push(`Array mismatch at ${path}`);
        return errors;
      }

      if (input.length !== output.length) {
        errors.push(`Array length mismatch at ${path}: ${input.length} vs ${output.length}`);
        return errors;
      }

      for (let i = 0; i < input.length; i++) {
        compareObjects(input[i], output[i], `${path}[${i}]`, errors);
      }

      return errors;
    }

    const inputRecord = input as Record<string, unknown>;
    const outputRecord = output as Record<string, unknown>;
    const inputKeys = Object.keys(inputRecord);
    const outputKeys = Object.keys(outputRecord);

    if (inputKeys.length !== outputKeys.length) {
      errors.push(`Key count mismatch at ${path}: ${inputKeys.length} vs ${outputKeys.length}`);
    }

    for (const key of inputKeys) {
      if (!(key in outputRecord)) {
        errors.push(`Missing key '${key}' at ${path}`);
        continue;
      }

      compareObjects(inputRecord[key], outputRecord[key], `${path}.${key}`, errors);
    }

    return errors;
  }

  if (input !== output) {
    errors.push(`Value mismatch at ${path}: '${String(input)}' vs '${String(output)}'`);
  }

  return errors;
}

export async function listRoundtripFixtures(fixturesDir = 'tests/fixtures/roundtrip'): Promise<string[]> {
  const entries = await readdir(fixturesDir, { withFileTypes: true });

  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.archimate'))
    .map(entry => join(fixturesDir, entry.name))
    .sort();
}

export async function roundtripFixture(fixturePath: string, outputDir: string): Promise<RoundtripResult> {
  await mkdir(outputDir, { recursive: true });
  const outputPath = join(outputDir, basename(fixturePath));
  const tsArchi = new TsArchi();

  await tsArchi.loadModel(fixturePath);
  await tsArchi.saveModel(outputPath);

  const inputXml = await readFile(fixturePath, 'utf8');
  const outputXml = await readFile(outputPath, 'utf8');
  const errors = compareObjects(normalizeXml(inputXml), normalizeXml(outputXml));

  return {
    fixturePath,
    outputPath,
    errors,
  };
}

export async function roundtripFixtures(fixturesDir = 'tests/fixtures/roundtrip'): Promise<RoundtripResult[]> {
  const tempDir = await mkdtemp(join(tmpdir(), 'tsarchi-roundtrip-'));

  try {
    const fixtures = await listRoundtripFixtures(fixturesDir);
    return await Promise.all(fixtures.map(fixture => roundtripFixture(fixture, tempDir)));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
