import chalk from 'chalk';
import { roundtripFixtures } from './roundtrip-utils.mjs';

async function main(): Promise<void> {
  const results = await roundtripFixtures();
  const failedResults = results.filter(result => result.errors.length > 0);

  if (failedResults.length > 0) {
    console.error(chalk.red.bold(`Roundtrip comparison failed for ${failedResults.length} fixture${failedResults.length === 1 ? '' : 's'}.`));

    for (const result of failedResults) {
      console.error(chalk.red(`\n${result.fixturePath}`));
      for (const error of result.errors) {
        console.error(chalk.red(error));
      }
    }

    process.exitCode = 1;
    return;
  }

  console.log(chalk.green.bold(`Roundtrip comparison passed for ${results.length} fixtures.`));
}

main().catch((error: unknown) => {
  const e = error as Error;
  console.error(chalk.red.bold('Roundtrip comparison failed: '), chalk.red(e.message));
  process.exitCode = 1;
});
