#!/usr/bin/env node

import { createStderrWriter, getArgs } from '../system';
import { extractArgs } from '../environment';
import { runAsScript } from '../scripts';
import { runCLI } from '../gready';

export function run(): Promise<void> {
  return runAsScript(
    function() {
      return runCLI({
        args: extractArgs(getArgs())
      }).then(() => undefined);
    },
    { writeToStderr: createStderrWriter() }
  );
}

if (require.main === module) {
  run();
}
