#!/usr/bin/env node_modules/.bin/ts-node
// Shebang is required, and file *has* to be executable: chmod +x file.test.js
// See: https://github.com/tapjs/node-tap/issues/313#issuecomment-250067741
import { test } from 'tap';
import { getYarnWorkspacesFromFiles } from '../../lib';

test('identify package.json as a yarn workspace', async (t) => {
  const workspaces = getYarnWorkspacesFromFiles(
    `${__dirname}/../fixtures/yarn-workspace/`,
    'package.json',
  );
  t.deepEqual(
    workspaces,
    ['packages/*', 'libs/*'],
    'Workspaces identified as expected',
  );
});

test('identify package.json as a yarn workspace when using alternate configuration format', async (t) => {
  const workspaces = getYarnWorkspacesFromFiles(
    `${__dirname}/../fixtures/yarn-workspace-alternate-config/`,
    'package.json',
  );
  t.deepEqual(workspaces, ['packages/*'], 'Workspaces identified as expected');
});

test('identify package.json as Not a workspace project', async (t) => {
  const workspaces = getYarnWorkspacesFromFiles(
    `${__dirname}/../fixtures/external-tarball/`,
    'package.json',
  );
  t.is(workspaces, false, 'Not a yarn workspace');
});

test('identify package.json as non workspace project when workspaces config does not have managed packages', async (t) => {
  const workspaces = getYarnWorkspacesFromFiles(
    `${__dirname}/../fixtures/yarn-workspace-missing-packages-config/`,
    'package.json',
  );
  t.is(workspaces, false, 'Not a yarn workspace');
});
