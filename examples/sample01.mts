import type { Element } from '../src/interfaces/Element.mjs';
import { TsArchi } from '../src/TsArchi.mjs';

// Simple argument parser
function parseArgs() {
  const args = process.argv.slice(2);
  const options: { input?: string; output?: string } = {};
  
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-i' || args[i] === '--input') && i + 1 < args.length) {
      options.input = args[i + 1];
      i++;
    } else if ((args[i] === '-o' || args[i] === '--output') && i + 1 < args.length) {
      options.output = args[i + 1];
      i++;
    }
  }
  
  if (!options.input || !options.output) {
    console.error('Usage: node sample01.mjs -i <input-file> -o <output-file>');
    console.error('  -i, --input   path to input .archimate file');
    console.error('  -o, --output  path to output .archimate file');
    process.exit(1);
  }
  
  return options as { input: string; output: string };
}

async function main() {
  const options = parseArgs();
  
  console.log('TSArchi Sample 01: Adding Application Component');
  console.log(`Input: ${options.input}`);
  console.log(`Output: ${options.output}`);
  
  const tsa = new TsArchi();
  await tsa.loadModel(options.input);

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
  
  await tsa.saveModel(options.output);
  console.log('Processing complete!');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
