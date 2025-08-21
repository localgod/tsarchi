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

  // Create some sample elements if they don't exist
  const webApp: Element = {
    id: model.generateRandomId(),
    type: 'ApplicationComponent',
    name: 'Web Application',
    properties: new Map([['technology', 'React'], ['status', 'active']])
  };

  const database: Element = {
    id: model.generateRandomId(),
    type: 'ApplicationComponent', 
    name: 'Database',
    properties: new Map([['technology', 'PostgreSQL'], ['status', 'active']])
  };

  const apiGateway: Element = {
    id: model.generateRandomId(),
    type: 'ApplicationComponent',
    name: 'API Gateway',
    properties: new Map([['technology', 'Kong'], ['status', 'active']])
  };

  const dataFlow: Element = {
    id: model.generateRandomId(),
    type: 'FlowRelationship',
    name: 'Data Flow',
    source: webApp.id,
    target: database.id
  };

  const apiCall: Element = {
    id: model.generateRandomId(),
    type: 'FlowRelationship', 
    name: 'API Call',
    source: webApp.id,
    target: apiGateway.id
  };

  // Add elements to model
  model.upsertElement(webApp);
  model.upsertElement(database);
  model.upsertElement(apiGateway);
  model.upsertElement(dataFlow);
  model.upsertElement(apiCall);

  console.log('Added sample elements to model');

  // Create a comprehensive application view
  const appView = model.createView('Application Architecture', {
    viewpoint: 'application',
    documentation: 'Overview of the application architecture'
  });

  console.log(`Created view: ${appView.name}`);

  // Add elements to the view with custom positioning and styling
  const webAppObj = model.addDiagramObject(appView.id, webApp.id, 
    { x: 100, y: 100, width: 140, height: 70 }, {
      fillColor: '#c9e7b7',
      textAlignment: 1
    });

  const dbObj = model.addDiagramObject(appView.id, database.id,
    { x: 100, y: 250, width: 140, height: 70 }, {
      fillColor: '#ffd93d',
      textAlignment: 1  
    });

  const gatewayObj = model.addDiagramObject(appView.id, apiGateway.id,
    { x: 300, y: 100, width: 140, height: 70 }, {
      fillColor: '#ff9999',
      textAlignment: 1
    });

  console.log('Added diagram objects to view');

  // Create connections between elements
  if (webAppObj && dbObj) {
    model.addConnection(appView.id, webAppObj.id, dbObj.id, dataFlow.id, {
      lineColor: '#0066cc',
      lineWidth: 2
    });
  }

  if (webAppObj && gatewayObj) {
    model.addConnection(appView.id, webAppObj.id, gatewayObj.id, apiCall.id, {
      lineColor: '#cc6600', 
      lineWidth: 2
    });
  }

  console.log('Added connections between elements');

  // Create a group to organize the components
  const group = model.addGroup(appView.id, 'Application Components', 
    { x: 50, y: 50, width: 450, height: 300 }, {
      fillColor: '#f0f8ff',
      documentation: 'Core application components'
    });

  console.log(`Added group: ${group?.name} to organize components`);

  // Auto-generate a view showing all application components
  const allAppComponents = model.findElementsByType('ApplicationComponent');
  if (allAppComponents.length > 0) {
    const autoView = model.generateViewFromElements(
      'All Application Components',
      allAppComponents.map(el => el.id),
      {
        layoutType: 'circular',
        includeRelationships: true,
        viewpoint: 'application'
      }
    );
    
    if (autoView) {
      console.log(`Auto-generated view: ${autoView.name} with ${autoView.children?.length} elements`);
    }
  }

  // Create a view by folder
  const businessView = model.createViewByFolder('Business Layer View', 'business', {
    layoutType: 'grid'
  });

  if (businessView) {
    console.log(`Created business view: ${businessView.name}`);
  } else {
    console.log('No business elements found for business view');
  }

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
