import { OperationalError } from './errors';
import { runCLI } from './cli';

/**
 * Run the gready CLI
 */
function runGready(): Promise<void> {
  const filePosition = process.argv.findIndex(a => a.match(/\.ts$/));
  const argsStart = filePosition >= 0 ? filePosition + 1 : 0;

  return runCLI({
    args: process.argv.slice(argsStart),
    stderr: process.stderr,
    stdout: process.stdout
  }).catch(function(error) {
    process.exitCode = 1;

    if (error instanceof OperationalError) {
      console.error(error.message);
    } else {
      console.error(error);
    }
  });
}

if (require.main === module) {
  runGready();
}
