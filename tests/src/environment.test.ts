import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';

import assert from '../helpers/assert';

import {
  extractArgs,
  paths,
  prepareDataDirectory
} from '../../src/environment';

describe('environment', function() {

  describe('extractArgs', function() {

    it('extracts args from a call to run a script with the node interpreter', function() {
      const cases = [
        [['/bin/node', 'file.js'], []],
        [['/bin/node', 'file.ts'], []],
        [['/bin/node', 'file.ts', 'alfa'], ['alfa']],
        [['/bin/node', 'file.ts', 'alfa', 'bravo'], ['alfa', 'bravo']],
        [['/usr/bin/node', 'file.ts', 'alfa'], ['alfa']],
        [['/bin/node', 'file.ts', 'node'], ['node']],
        [['c:\\bin\\node.exe', 'file.ts', 'alfa'], ['alfa']]
      ];

      cases.forEach(function([input, expected]) {
        assert.deepEqual(extractArgs(input), expected);
      });
    });

    it('handles args without an interpreter', function() {
      assert.deepEqual(
        extractArgs(['file.js', 'alfa']),
        ['file.js', 'alfa']
      );
    });

  });

  describe('paths', function() {

    it('maps labels to paths', function() {
      const fsPaths = Object.values(paths);

      assert.isNotEmpty(fsPaths);

      fsPaths.forEach(function(fsPath) {
        assert.isTrue(path.isAbsolute(fsPath));
      });
    });

  });

  describe('prepareDataDirectory', function() {

    function getDirPath(): string {
      return path.join(tmp.dirSync().name, 'data');
    }

    it('creates cache directories', async function() {
      const { cacheDirs } = await prepareDataDirectory(getDirPath());

      assert.isTrue(fs.statSync(cacheDirs.apiRequests).isDirectory());
      assert.isTrue(fs.statSync(cacheDirs.data).isDirectory());
    });

    it('ignores an existing directory structure', async function() {
      const dirPath = getDirPath();

      const first = await prepareDataDirectory(dirPath);
      const second = await prepareDataDirectory(dirPath);

      assert.deepEqual(first, second);
    });

  });

});
