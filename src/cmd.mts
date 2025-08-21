import { Command } from 'commander';
import type { Element } from './interfaces/Element.mjs';
import { TsArchi } from './TsArchi.mjs';

const program = new Command()
program.name('sync')
program.description('Parse mood to archi import files');
program.requiredOption('-i, --input <path>', 'path to input file');
program.requiredOption('-o, --output <path>', 'path to output file');
program.action(async (options: { input: string, output: string }) => {
  const tsa = new TsArchi()
  await tsa.loadModel(options.input)

  const newAppComponent: Element = {
    id: tsa.getModel().generateRandomId(), 
    type: 'ApplicationComponent',
    name: 'New Application Component',
    properties: new Map([['version', '1.0'], ['status', 'planned']])
  };
  
  const existingComponent = tsa.getModel().findElementInFolderByName('application', 'New Application Component');
  if (!existingComponent) {
    tsa.getModel().upsertElement(newAppComponent);
  } else {
    console.log('Application component already exists, skipping creation.');
  }
  await tsa.saveModel(options.output)
})
program.parse()
