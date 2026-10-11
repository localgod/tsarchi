import { TextAlignment, Viewpoint } from '../src/constants/archi-codes.mjs';
import { TsArchi } from '../src/node/TsArchi.mjs';

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
    console.error('Usage: node sample02.mjs -i <input-file> -o <output-file>');
    console.error('  -i, --input   path to input .archimate file');
    console.error('  -o, --output  path to output .archimate file');
    process.exit(1);
  }

  return options as { input: string; output: string };
}

async function main() {
  const options = parseArgs();

  console.log('TSArchi Sample 02: View Management Demo');
  console.log(`Input: ${options.input}`);
  console.log(`Output: ${options.output}`);

  const tsa = new TsArchi();
  const model = await tsa.loadModel(options.input);

  // Add sample elements. The model assigns ids and returns copies that carry them.
  const webApp = model.upsertElement({
    type: 'ApplicationComponent',
    name: 'Web Application',
    properties: new Map([
      ['technology', 'React'],
      ['status', 'active'],
    ]),
  });

  const database = model.upsertElement({
    type: 'ApplicationComponent',
    name: 'Database',
    properties: new Map([
      ['technology', 'PostgreSQL'],
      ['status', 'active'],
    ]),
  });

  const apiGateway = model.upsertElement({
    type: 'ApplicationComponent',
    name: 'API Gateway',
    properties: new Map([
      ['technology', 'Kong'],
      ['status', 'active'],
    ]),
  });

  // Relationships are checked against Archi's relationships matrix.
  const dataFlow = model.upsertRelationship({
    type: 'FlowRelationship',
    name: 'Data Flow',
    source: webApp.id,
    target: database.id,
  });

  const apiCall = model.upsertRelationship({
    type: 'FlowRelationship',
    name: 'API Call',
    source: webApp.id,
    target: apiGateway.id,
  });

  console.log('Added sample elements to model');

  // Create a comprehensive application view
  const appView = model.createView('Application Architecture', {
    viewpoint: Viewpoint.ApplicationCooperation,
    documentation: 'Overview of the application architecture',
  });

  console.log(`Created view: ${appView.name}`);

  // Add elements to the view with custom positioning and styling
  const webAppObj = model.addDiagramObject(
    appView.id,
    webApp.id,
    { x: 100, y: 100, width: 140, height: 70 },
    {
      fillColor: '#c9e7b7',
      textAlignment: TextAlignment.Left,
    }
  );

  const dbObj = model.addDiagramObject(
    appView.id,
    database.id,
    { x: 100, y: 250, width: 140, height: 70 },
    {
      fillColor: '#ffd93d',
      textAlignment: TextAlignment.Left,
    }
  );

  const gatewayObj = model.addDiagramObject(
    appView.id,
    apiGateway.id,
    { x: 300, y: 100, width: 140, height: 70 },
    {
      fillColor: '#ff9999',
      textAlignment: TextAlignment.Left,
    }
  );

  console.log('Added diagram objects to view');

  // Create connections between elements
  if (webAppObj && dbObj) {
    model.addConnection(appView.id, webAppObj.id, dbObj.id, dataFlow.id, {
      lineColor: '#0066cc',
      lineWidth: 2,
    });
  }

  if (webAppObj && gatewayObj) {
    model.addConnection(appView.id, webAppObj.id, gatewayObj.id, apiCall.id, {
      lineColor: '#cc6600',
      lineWidth: 2,
    });
  }

  console.log('Added connections between elements');

  // Create a group to organize the components
  const group = model.addGroup(
    appView.id,
    'Application Components',
    { x: 50, y: 50, width: 450, height: 300 },
    {
      fillColor: '#f0f8ff',
      documentation: 'Core application components',
    }
  );

  console.log(`Added group: ${group?.name} to organize components`);

  // List all views
  const allViews = model.listViews();
  console.log(`\nTotal views in model: ${allViews.length}`);
  allViews.forEach(view => {
    console.log(`- ${view.name} (${view.children?.length || 0} children)`);
  });

  // Save the enhanced model
  await tsa.saveModel(options.output);
  console.log('\nView management demo complete!');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
