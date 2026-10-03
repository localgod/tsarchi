import { describe, it, expect } from 'vitest';
import { readdir, readFile } from 'fs/promises';
import { builtinModules } from 'module';
import { join } from 'path';

const srcDir = new URL('../src/', import.meta.url);
const builtins = new Set(builtinModules.flatMap(name => [name, `node:${name}`]));

async function sourceFiles(): Promise<string[]> {
  const entries = await readdir(srcDir, { recursive: true });
  return entries.filter(entry => entry.endsWith('.mts'));
}

/** The package name of every bare import or export specifier in a source file. */
function importedPackages(source: string): string[] {
  const specifiers = [...source.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map(match => match[1]);
  return specifiers
    .filter(specifier => !specifier.startsWith('.') && !builtins.has(specifier))
    .map(specifier =>
      specifier
        .split('/')
        .slice(0, specifier.startsWith('@') ? 2 : 1)
        .join('/')
    );
}

describe('package dependencies', () => {
  it('declares exactly the packages that src imports as runtime dependencies', async () => {
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const imported = new Set<string>();
    for (const file of await sourceFiles()) {
      for (const name of importedPackages(await readFile(join(srcDir.pathname, file), 'utf8'))) {
        imported.add(name);
      }
    }

    expect(Object.keys(packageJson.dependencies ?? {}).sort()).toEqual([...imported].sort());
  });
});
