#!/usr/bin/env node

import { extractArgs } from '../environment';
import { OperationalError } from '../errors';
import { runCLI } from '../gready';

/**
 * Run the gready CLI
 */
function runGready(): Promise<void> {
  return runCLI({
    args: extractArgs(process.argv),
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

runGready();
