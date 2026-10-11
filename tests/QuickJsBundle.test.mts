import { describe, it, expect, beforeAll } from 'vitest';
import { readdir, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { build, type Rollup } from 'vite';
import { newQuickJSWASMModuleFromVariant, type QuickJSWASMModule } from 'quickjs-emscripten-core';
import releaseSyncVariant from '@jitl/quickjs-wasmfile-release-sync';
import { Archimate } from '../src/Archimate.mjs';

const roundtripDir = new URL('./fixtures/roundtrip/', import.meta.url);

/** Bundles the built package index, with fast-xml-parser, into one ES module, as a QuickJS user would. */
async function bundle(entry: string): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: { entry: fileURLToPath(new URL(entry, import.meta.url)), formats: ['es'], fileName: 'index' },
    },
  });
  return ((Array.isArray(result) ? result[0] : result) as Rollup.RolldownOutput).output[0].code;
}

/**
 * Runs a module in a fresh QuickJS context, where `tsarchi` imports the bundle and `input` holds the given value, and
 * returns what the module assigns to `globalThis.result`. QuickJS has no Node or web APIs such as `structuredClone`.
 */
function runInQuickJs(quickJs: QuickJSWASMModule, tsarchi: string, script: string, input: unknown): any {
  const runtime = quickJs.newRuntime();
  runtime.setModuleLoader(name => {
    if (name === 'tsarchi') return tsarchi;
    throw new Error(`Unknown module ${name}`);
  });
  const vm = runtime.newContext();
  try {
    const inputHandle = vm.newString(JSON.stringify(input));
    vm.setProp(vm.global, 'input', inputHandle);
    inputHandle.dispose();

    vm.unwrapResult(vm.evalCode(script, 'main.mjs', { type: 'module' })).dispose();
    runtime.executePendingJobs();

    const result = vm.getProp(vm.global, 'result');
    const value = vm.dump(result);
    result.dispose();
    return value;
  } finally {
    vm.dispose();
    runtime.dispose();
  }
}

describe('QuickJS bundle', () => {
  let quickJs: QuickJSWASMModule;
  let tsarchi: string;

  beforeAll(async () => {
    quickJs = await newQuickJSWASMModuleFromVariant(releaseSyncVariant);
    tsarchi = await bundle('../dist/src/index.mjs');
  }, 60_000);

  it('loads and saves every round-trip fixture as in Node', async () => {
    const files = (await readdir(roundtripDir)).filter(file => file.endsWith('.archimate')).toSorted();
    const xmls = await Promise.all(files.map(file => readFile(new URL(file, roundtripDir), 'utf8')));

    const result = runInQuickJs(
      quickJs,
      tsarchi,
      `import { Archimate } from 'tsarchi';
      globalThis.result = JSON.parse(input).map(xml => {
        try {
          return Archimate.fromXml(xml).toXml();
        } catch (error) {
          return String(error);
        }
      });`,
      xmls
    );

    expect(result).toEqual(xmls.map(xml => Archimate.fromXml(xml).toXml()));
  });

  it('edits a model and copies it without structuredClone', async () => {
    const xml = await readFile(new URL('nested-diagram-objects.archimate', roundtripDir), 'utf8');

    const result = runInQuickJs(
      quickJs,
      tsarchi,
      `import { Archimate, ArchimateParseError } from 'tsarchi';
      const steps = {};
      const step = (name, fn) => {
        try {
          steps[name] = fn();
        } catch (error) {
          steps[name] = 'threw ' + String(error);
        }
      };
      const model = Archimate.fromXml(JSON.parse(input));
      let app;
      let data;
      step('structuredClone', () => typeof structuredClone);
      step('upsertElement', () => {
        app = model.upsertElement({ name: 'App', type: 'ApplicationComponent', properties: new Map([['k', 'v']]) });
        data = model.upsertElement({ name: 'Data', type: 'DataObject' });
        return [...app.properties];
      });
      step('upsertRelationship', () =>
        model.upsertRelationship({ name: '', type: 'AccessRelationship', source: app.id, target: data.id, accessType: 1 })
          .accessType
      );
      step('updateElement', () => [...model.updateElement(app.id, { properties: new Map([['x', 'y']]) }).properties]);
      step('views', () => model.findElementsByType('ArchimateDiagramModel').map(view => view.child !== undefined));
      step('getView', () => model.getView(model.listViews()[0].id).children.length);
      step('addToView', () => {
        const view = model.createView('New');
        const a = model.addDiagramObject(view.id, app.id, { x: 0, y: 0, width: 120, height: 55 });
        const b = model.addDiagramObject(view.id, data.id, { x: 200, y: 0, width: 120, height: 55 });
        return model.addConnection(view.id, a.id, b.id).source === a.id;
      });
      step('getFolders', () => model.getFolders('application').length);
      step('snapshot', () => {
        const restored = Archimate.fromSnapshot(JSON.parse(JSON.stringify(model.snapshot())));
        return restored.toXml() === model.toXml();
      });
      step('validateModel', () => model.validateModel().length);
      step('deleteElement', () => model.deleteElement(data.id));
      step('parseError', () => {
        try {
          Archimate.fromXml('<x');
        } catch (error) {
          return error instanceof ArchimateParseError;
        }
      });
      globalThis.result = steps;`,
      xml
    );

    expect(result).toEqual({
      structuredClone: 'undefined',
      upsertElement: [['k', 'v']],
      upsertRelationship: 1,
      updateElement: [
        ['k', 'v'],
        ['x', 'y'],
      ],
      views: [true],
      getView: expect.any(Number),
      addToView: true,
      getFolders: 0,
      snapshot: true,
      validateModel: 0,
      deleteElement: true,
      parseError: true,
    });
  });
});
