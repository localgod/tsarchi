import * as fs from 'fs'
import { XMLParser } from 'fast-xml-parser'
import chalk from 'chalk'
import { Command } from 'commander'

const program = new Command();


program
  .version('1.0.0')
  .description('XML Comparison Tool')
  .requiredOption('-i, --input <inputFile>', 'input XML file path')
  .requiredOption('-o, --output <outputFile>', 'output XML file path')
  .parse(process.argv);

const options = program.opts();


const inputFilePath = options.input;
const outputFilePath = options.output;

// Function to read and parse XML with normalization
function parseAndNormalizeXML(filePath: string): any {
  const fileContent = fs.readFileSync(filePath, 'utf8');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true,
    parseTagValue: true,
    allowBooleanAttributes: true
  });

  return { parsed: parser.parse(fileContent), raw: fileContent.split('\n') };
}

// Function to compare two XML objects and accumulate errors
function compareXMLObjects(
  inputXML: any, outputXML: any, inputLines: string[], outputLines: string[], path = '', errors: string[] = []
): void {
  if (typeof inputXML !== typeof outputXML) {
    errors.push(`Type mismatch at ${path}: ${typeof inputXML} vs ${typeof outputXML}`);
    return;
  }

  if (typeof inputXML === 'object') {
    if (Array.isArray(inputXML)) {
      if (inputXML.length !== outputXML.length) {
        errors.push(`Array length mismatch at ${path}: ${inputXML.length} vs ${outputXML.length}`);
        return;
      }

      for (let i = 0; i < inputXML.length; i++) {
        compareXMLObjects(inputXML[i], outputXML[i], inputLines, outputLines, `${path}[${i}]`, errors);
      }
    } else {
      const inputKeys = Object.keys(inputXML);
      const outputKeys = Object.keys(outputXML);

      if (inputKeys.length !== outputKeys.length) {
        errors.push(`Key count mismatch at ${path}: ${inputKeys.length} vs ${outputKeys.length}`);
      }

      for (const key of inputKeys) {
        if (!(key in outputXML)) {
          errors.push(`Missing key '${key}' at ${path}`);
          continue;
        }

        compareXMLObjects(inputXML[key], outputXML[key], inputLines, outputLines, `${path}.${key}`, errors);
      }
    }
  } else if (inputXML !== outputXML) {
    errors.push(`Value mismatch at ${path}: '${inputXML}' vs '${outputXML}'`);
  }
}

// Function to find the line number of a given element or value in raw XML
function findLineNumber(element: string, xmlLines: string[], value: string | null = null): number {
  const tagMatch = element.match(/([a-zA-Z_][\w-]*)$/); // Extract tag or attribute name

  if (tagMatch) {
    const tagName = tagMatch[0];
    const openingTagRegex = new RegExp(`<${tagName}(\\s|>|/)`); // Matches opening tag with or without attributes

    for (let i = 0; i < xmlLines.length; i++) {
      if (openingTagRegex.test(xmlLines[i])) {
        if (value && !xmlLines[i].includes(value)) {
          continue; // Check if the value exists in the same line (for elements with text content)
        }
        return i + 1; // Return the line number (1-based index)
      }
    }
  }

  return -1; // Not found
}

// Main test function to compare input and output XML
(async () => {
  try {
    const inputXMLData = parseAndNormalizeXML(inputFilePath);
    const outputXMLData = parseAndNormalizeXML(outputFilePath);

    const errors: string[] = [];

    // Compare the XMLs and accumulate all errors
    compareXMLObjects(inputXMLData.parsed, outputXMLData.parsed, inputXMLData.raw, outputXMLData.raw, '', errors);

    if (errors.length > 0) {
      console.error(chalk.red.bold("Test Failed: Errors found."));

      for (const error of errors) {
        console.error(chalk.red(error));

        // Extract the mismatched element and values from the error message
        const [path, inputValue, outputValue] = error.match(/at (.+?): '(.*?)' vs '(.*?)'/) || [];
        const mismatchedElement = path?.split('.').pop(); // Extract the element name

        if (mismatchedElement) {
          // Find line numbers in both input and output XML files
          const inputLineNumber = findLineNumber(mismatchedElement, inputXMLData.raw, inputValue);
          const outputLineNumber = findLineNumber(mismatchedElement, outputXMLData.raw, outputValue);

          if (inputLineNumber !== -1) {
            console.error(chalk.yellow(`Mismatch found in '${chalk.cyan(inputFilePath)}' at line ${inputLineNumber}`));
          } else {
            console.error(chalk.yellow(`Mismatch in '${chalk.cyan(inputFilePath)}' but line not found.`));
          }

          if (outputLineNumber !== -1) {
            console.error(chalk.yellow(`Mismatch found in '${chalk.cyan(outputFilePath)}' at line ${outputLineNumber}`));
          } else {
            console.error(chalk.yellow(`Mismatch in '${chalk.cyan(outputFilePath)}' but line not found.`));
          }
        }
      }
    } else {
      console.log(chalk.green.bold("Test Passed: XML files are identical."));
    }
  } catch (error) {
    const e = error as Error
    console.error(chalk.red.bold("Test Failed: "), chalk.red(e.message));
  }
})();
