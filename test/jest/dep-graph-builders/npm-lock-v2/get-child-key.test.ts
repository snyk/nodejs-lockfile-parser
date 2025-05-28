import { getChildNodeKey } from '../../../../lib/dep-graph-builders/npm-lock-v2/index';

describe('npm-lock-v2 getChildNodeKey', () => {
  it('should filter out candidate keys that have pkgs that are not in ancestry being tested', async () => {
    const name = 'global-modules';
    const ancestry = [
      { id: 'root-node', name: 'test-root', key: '', inBundle: false },
      {
        id: '@storybook/test-runner',
        name: '@storybook/test-runner',
        key: 'node_modules/@storybook/test-runner',
        inBundle: false,
      },
      {
        id: 'jest-playwright-preset',
        name: 'jest-playwright-preset',
        key: 'node_modules/@storybook/test-runner/node_modules/jest-playwright-preset',
        inBundle: false,
      },
      {
        id: 'jest-process-manager',
        name: 'jest-process-manager',
        key: 'node_modules/jest-process-manager',
        inBundle: false,
      },
      { id: 'cwd', name: 'cwd', key: 'node_modules/cwd', inBundle: false },
      {
        id: 'find-pkg',
        name: 'find-pkg',
        key: 'node_modules/find-pkg',
        inBundle: false,
      },
      {
        id: 'find-file-up',
        name: 'find-file-up',
        key: 'node_modules/find-file-up',
        inBundle: false,
      },
      {
        id: 'resolve-dir',
        name: 'resolve-dir',
        key: 'node_modules/find-file-up/node_modules/resolve-dir',
        inBundle: false,
      },
    ];
    const pkgs = {
      'node_modules/stylelint/node_modules/global-modules': {
        version: '1.0.0',
      },
      'node_modules/find-file-up/node_modules/global-modules': {
        version: '1.0.0',
      },
    };
    const pkgKeysByName = new Map([
      [
        'global-modules',
        [
          'node_modules/find-file-up/node_modules/global-modules',
          'node_modules/stylelint/node_modules/global-modules',
        ],
      ],
    ]);

    const childKey = getChildNodeKey(
      name,
      '1.0.0',
      ancestry,
      pkgs,
      pkgKeysByName,
    );
    expect(childKey).toBe(
      'node_modules/find-file-up/node_modules/global-modules',
    );
  });
});
