// scripts/write-json-schema.js
// Writes the JSON Schema of tsarchi's JSON format from the compiled source, for the repository and the package.
// Run after `tsc`: `npm run build` does. tests/JsonFormat.test.mts fails if the committed file is out of date.
import { mkdirSync, writeFileSync } from 'fs';
import { modelJsonSchema } from '../dist/src/constants/model-json-schema.mjs';

mkdirSync('schema', { recursive: true });
writeFileSync('schema/model-v1.json', `${JSON.stringify(modelJsonSchema, null, 2)}\n`);
console.log('Wrote schema/model-v1.json.');
