import { createStderrWriter, createStdoutWriter } from '../system';
import { paths } from '../environment';
import { removePaths } from '../scripts';

export function run(): Promise<void> {
  return removePaths(
    'Clear test fixtures',
    [
      paths.apiFixturesDir,
      paths.networkFixturesDir
    ],
    {
      writeToStderr: createStderrWriter(),
      writeToStdout: createStdoutWriter()
    }
  );
}

/* istanbul ignore if */
if (require.main === module) {
  run();
}
