import { describe, it, expect } from 'vitest';
import { builtinModules } from 'module';
import { fileURLToPath } from 'url';
import { build, type Plugin } from 'vite';

const builtins = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));

/** Records every Node built-in the bundle tries to import, instead of letting Vite stub it. */
function recordNodeBuiltins(imported: string[]): Plugin {
  return {
    name: 'record-node-builtins',
    enforce: 'pre',
    resolveId(source, importer) {
      if (builtins.has(source)) {
        imported.push(`${source} (from ${importer})`);
      }
      return null;
    },
  };
}

async function bundleForBrowser(entry: string): Promise<string[]> {
  const imported: string[] = [];
  await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [recordNodeBuiltins(imported)],
    build: {
      write: false,
      minify: false,
      lib: { entry: fileURLToPath(new URL(entry, import.meta.url)), formats: ['es'], fileName: 'index' },
    },
  });
  return imported;
}

describe('browser bundle', () => {
  it('bundles the package index for the browser without Node built-ins', async () => {
    expect(await bundleForBrowser('../dist/src/index.mjs')).toEqual([]);
  });
});
