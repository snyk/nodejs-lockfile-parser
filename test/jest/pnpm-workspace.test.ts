#!/usr/bin/env node_modules/.bin/ts-node
// Shebang is required, and file *has* to be executable: chmod +x file.test.js
// See: https://github.com/tapjs/node-tap/issues/313#issuecomment-250067741
import { getPnpmWorkspacesFromFiles } from '../../lib';

describe('buildDepTreeFromFiles', () => {
  it('Identify package.json as a pnpm workspace', async () => {
    const workspace = await getPnpmWorkspacesFromFiles(
      `${__dirname}/../fixtures/pnpm/workspace/simple_workspace`,
      'pnpm-workspace.yaml',
    );

    expect(workspace).toMatchObject(['packages/**']);
  });

  it.skip('identify package.json as Not a workspace project', async () => {
    expect(
      getPnpmWorkspacesFromFiles(
        `${__dirname}/../fixtures/pnpm/workspace/no_workspace/`,
        'pnpm-workspace.yaml',
      ),
    ).rejects.toThrowError('Target file not found at :');
  });
});
