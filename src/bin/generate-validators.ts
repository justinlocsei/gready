import fs from 'graceful-fs';
import path from 'path';
import { mkdirp } from 'fs-extra';
import { promisify } from 'util';

import { createStderrWriter, createStdoutWriter } from '../system';
import { generateValidator } from '../validators';
import { OutputHandler } from '../types/system';
import { paths } from '../environment';
import { runAsScript } from '../scripts';

const writeFileAsync = promisify(fs.writeFile);

const TYPE_FILES = ['api.ts', 'config.ts'];

/**
 * Write generated validation code for a subset of types to disk
 */
async function writeValidators(log: OutputHandler): Promise<void> {
  await mkdirp(paths.validatorsDir);

  for (const typeFile of TYPE_FILES) {
    const inputPath = path.join(paths.typesDir, typeFile);
    log(inputPath);

    const outputPath = await writeValidator(inputPath);
    log(`  => ${outputPath}`);
  }
}

/**
 * Write generated code for a validator to a directory
 */
async function writeValidator(typesFile: string): Promise<string> {
  const targetDir = path.join(
    paths.validatorsDir,
    path.basename(typesFile, '.ts')
  );

  const files = generateValidator(typesFile, targetDir);

  await mkdirp(targetDir);

  for (const file of Object.values(files)) {
    await writeFileAsync(file.path, file.content + '\n');
  }

  return targetDir;
}

export function run() {
  runAsScript(
    () => writeValidators(createStdoutWriter()),
    { writeToStderr: createStderrWriter() }
  );
}

if (require.main === module) {
  run();
}
