import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import { TsArchi } from '../src/node/TsArchi.mjs';
import { buildArchimateXml } from '../src/internal/Xml.mjs';
import { compareObjects, normalizeXml } from './roundtrip-utils.mjs';

/**
 * Loads each .archimate file, serializes it without validation and reports what did not survive,
 * grouped by kind and location. Unlike roundtrip-compare this works on models that fail validation,
 * such as the Archi-produced files in tests/fixtures/archi.
 *
 * Usage: node dist/tests/roundtrip-diff.mjs [--verbose] [--json] [file-or-directory ...]
 */

const DEFAULT_TARGETS = ['tests/fixtures/archi', 'tests/fixtures/roundtrip'];

interface FileReport {
  file: string;
  differences: number;
  groups: Record<string, number>;
  details: string[];
  validation: Record<string, number>;
}

async function expandTargets(targets: string[]): Promise<string[]> {
  const files: string[] = [];
  for (const target of targets) {
    if ((await stat(target)).isDirectory()) {
      const entries = await readdir(target, { withFileTypes: true });
      files.push(
        ...entries
          .filter(entry => entry.isFile() && entry.name.endsWith('.archimate'))
          .map(entry => join(target, entry.name))
          .sort()
      );
    } else {
      files.push(target);
    }
  }
  return files;
}

/**
 * Turns ".archimate:model.folder[2].element[5].child[0].lineColor" into "child.lineColor",
 * so the same loss across many elements is counted once.
 */
function location(path: string): string {
  const segments = path
    .replace(/\[\d+\]/g, '')
    .split('.')
    .filter(Boolean);
  return segments.slice(-2).join('.') || '(root)';
}

function groupKey(message: string): string {
  let match = /^Missing key '(.+)' at (.*)$/.exec(message);
  if (match) return `missing   ${location(`${match[2]}.${match[1]}`)}`;
  match = /^Value mismatch at (\S*):/.exec(message);
  if (match) return `value     ${location(match[1])}`;
  match = /^Type mismatch at (\S*):/.exec(message);
  if (match) return `type      ${location(match[1])}`;
  match = /^Array length mismatch at (\S*):/.exec(message);
  if (match) return `length    ${location(match[1])}`;
  match = /^Array mismatch at (.*)$/.exec(message);
  if (match) return `array     ${location(match[1])}`;
  match = /^Key count mismatch at (\S*):/.exec(message);
  if (match) return `key count ${location(match[1])}`;
  return message;
}

async function diffFile(file: string): Promise<FileReport> {
  const tsArchi = new TsArchi();
  const archimate = await tsArchi.loadModel(file);

  const validation: Record<string, number> = {};
  for (const issue of archimate.validateModel()) {
    validation[issue.code] = (validation[issue.code] ?? 0) + 1;
  }

  // Written as toXml() does, without its validation, so files with validation errors are compared too
  const outputXml = buildArchimateXml(archimate.serialize());
  const inputXml = await readFile(file, 'utf8');
  const details = compareObjects(normalizeXml(inputXml), normalizeXml(outputXml));

  const groups: Record<string, number> = {};
  for (const message of details) {
    const key = groupKey(message);
    groups[key] = (groups[key] ?? 0) + 1;
  }

  return { file, differences: details.length, groups, details, validation };
}

function printReport(report: FileReport, verbose: boolean): void {
  const status = report.differences === 0 ? chalk.green('identical') : chalk.yellow(`${report.differences} differences`);
  console.log(`\n${chalk.bold(report.file)}: ${status}`);

  const sorted = Object.entries(report.groups).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [key, count] of sorted) {
    console.log(`  ${String(count).padStart(5)}  ${key}`);
  }

  const issues = Object.entries(report.validation);
  if (issues.length > 0) {
    console.log(chalk.red(`  validation: ${issues.map(([code, count]) => `${code} ×${count}`).join(', ')}`));
  }

  if (verbose) {
    for (const message of report.details) {
      console.log(chalk.dim(`    ${message}`));
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const json = args.includes('--json');
  const targets = args.filter(arg => !arg.startsWith('--'));
  const files = await expandTargets(targets.length > 0 ? targets : DEFAULT_TARGETS);

  const reports: FileReport[] = [];
  for (const file of files) {
    reports.push(await diffFile(file));
  }

  if (json) {
    console.log(
      JSON.stringify(
        reports.map(({ details, ...rest }) => (verbose ? { ...rest, details } : rest)),
        null,
        2
      )
    );
    return;
  }

  for (const report of reports) {
    printReport(report, verbose);
  }

  console.log(`\n${chalk.bold('Summary')}`);
  for (const report of reports) {
    const invalid = Object.values(report.validation).reduce((sum, count) => sum + count, 0);
    console.log(
      `  ${String(report.differences).padStart(5)} differences  ${String(invalid).padStart(4)} validation issues  ${report.file}`
    );
  }
}

main().catch((error: unknown) => {
  const e = error as Error;
  console.error(chalk.red.bold('Roundtrip diff failed: '), chalk.red(e.stack ?? e.message));
  process.exitCode = 1;
});
