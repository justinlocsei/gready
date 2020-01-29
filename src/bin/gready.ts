#!/usr/bin/env node

import { extractArgs } from '../environment';
import { getArgs } from '../system';
import { runAsScript } from '../scripts';
import { runCLI } from '../gready';

/**
 * Run the gready CLI
 */
function runGready(): Promise<void> {
  return runCLI({
    args: extractArgs(getArgs())
  }).then(() => undefined);
}

runAsScript(runGready);
