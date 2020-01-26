type MessageLogger = (message: string) => void;

/**
 * Read the value of an environment variable
 */
export function getEnvironmentVariable(name: string): string | undefined {
  return process.env[name];
}

/**
 * Create a function that writes a message to a stream
 */
function createLogger(stream: NodeJS.WritableStream): MessageLogger {
  return function(message: string) {
    stream.write(message + '\n');
  };
}

/**
 * Create a logging function to show non-essential output metadata
 */
export function createMetaLogger(): MessageLogger {
  return createLogger(process.stderr);
}

/**
 * Create a logging function to show program output to the user
 */
export function createOutputLogger(): MessageLogger {
  return createLogger(process.stdout);
}

/**
 * Mark the current process as failed
 */
export function markProcessAsFailed(): void {
  process.exitCode = 1;
}
