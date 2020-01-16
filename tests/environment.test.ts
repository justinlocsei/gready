import assert from './assert';
import fs from 'graceful-fs';
import path from 'path';
import tmp from 'tmp';

import {
  extractArgs,
  paths,
  prepareDataDirectory,
  resolveRequire
} from '../src/environment';

describe('environment/extractArgs', function() {

  it('extracts args from a call to run a script with the node interpreter', function() {
    const cases = [
      [['/bin/node', 'file.js'], []],
      [['/bin/node', 'file.ts'], []],
      [['/bin/node', 'file.ts', 'alfa'], ['alfa']],
      [['/bin/node', 'file.ts', 'alfa', 'bravo'], ['alfa', 'bravo']],
      [['/usr/bin/node', 'file.ts', 'alfa'], ['alfa']],
      [['/bin/node', 'file.ts', 'node'], ['node']]
    ];

    cases.forEach(function([input, expected]) {
      assert.deepEqual(extractArgs(input), expected);
    });
  });

  it('handles args without an interpreter', function() {
    assert.deepEqual(
      ['file.js', 'alfa'],
      ['file.js', 'alfa']
    );
  });

});

describe('environment/paths', function() {

  it('maps labels to paths', function() {
    const fsPaths = Object.values(paths);

    assert.isNotEmpty(fsPaths);

    fsPaths.forEach(function(fsPath) {
      assert.isTrue(path.isAbsolute(fsPath));
    });
  });

});

describe('environment/prepareDataDirectory', function() {

  let tmpDir: tmp.DirResult;
  let tmpDirPath: string;

  beforeEach(function() {
    tmpDir = tmp.dirSync();
    tmpDirPath = path.join(tmpDir.name, 'data');
  })

  afterEach(function() {
    tmpDir.removeCallback();
  });

  it('creates cache directories', async function() {
    const { cacheDirs } = await prepareDataDirectory(tmpDirPath);

    assert.isTrue(fs.statSync(cacheDirs.apiRequests).isDirectory());
    assert.isTrue(fs.statSync(cacheDirs.data).isDirectory());
  });

  it('ignores an existing directory structure', async function() {
    const first = await prepareDataDirectory(tmpDirPath);
    const second = await prepareDataDirectory(tmpDirPath);

    assert.deepEqual(first, second);
  });

  it('defines a path to a session file in the created directories', async function() {
    const { sessionFile } = await prepareDataDirectory(tmpDirPath);

    assert.notMatch(path.relative(tmpDirPath, sessionFile), /\.\./);
  });

});

describe('environment/resolveRequire', function() {

  it('resolves paths below the root', function() {
    assert.equal(
      resolveRequire('/root', '/root/file.ts'),
      './file.ts'
    );
  });

  it('resolves paths above the root', function() {
    assert.equal(
      resolveRequire('/root/dir', '/root/file.ts'),
      '../file.ts'
    );
  });

  it('can remove the extension', function() {
    assert.equal(
      resolveRequire('/root', '/root/file.ts', '.ts'),
      './file'
    );
  });

});
