#!/usr/bin/env node

import { extractArgs } from '../environment';
import { runAsScript } from '../scripts';
import { runCLI } from '../gready';

/**
 * Run the gready CLI
 */
function runGready(): Promise<void> {
  return runCLI({
    args: extractArgs(process.argv),
    stderr: process.stderr,
    stdout: process.stdout
  });
}

runAsScript(runGready, { stderr: process.stderr });
