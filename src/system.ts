import { OutputHandler } from './types/system';

/**
 * Read the value of an environment variable
 */
export function getEnvironmentVariable(name: string): string | undefined {
  return process.env[name];
}

/**
 * Create a function that writes a message to a stream
 */
function createStreamWriter(stream: NodeJS.WritableStream): OutputHandler {
  return function(message: string) {
    stream.write(message + '\n');
  };
}

/**
 * Create a function to write output to stderr
 */
export function createStderrWriter(): OutputHandler {
  return createStreamWriter(process.stderr);
}

/**
 * Create a function to write output to stdout
 */
export function createStdoutWriter(): OutputHandler {
  return createStreamWriter(process.stdout);
}

/**
 * Mark the current process as failed
 */
export function markProcessAsFailed(): void {
  process.exitCode = 1;
}
