import { join } from 'path';
import { readFileSync } from 'fs';
import { createFromJSON } from '@snyk/dep-graph';
import {
  InvalidUserInputError,
  LockfileType,
  OutOfSyncError,
  parseYarnLockV1Project,
} from '../../../lib';

describe('yarn.lock v1 "real projects"', () => {
  describe('Expected Result tests', () => {
    describe.each([
      'one-dep',
      'goof',
      'external-tarball',
      'file-as-version',
      'file-as-version-no-lock-entry',
      'git-ssh-url-deps',
      'npm-protocol',
    ])('[simple tests] project: %s ', (fixtureName) => {
      test('matches expected', async () => {
        const pkgJsonContent = readFileSync(
          join(
            __dirname,
            `./fixtures/yarn-lock-v1/real/${fixtureName}/package.json`,
          ),
          'utf8',
        );
        const yarnLockContent = readFileSync(
          join(
            __dirname,
            `./fixtures/yarn-lock-v1/real/${fixtureName}/yarn.lock`,
          ),
          'utf8',
        );

        const newDepGraph = await parseYarnLockV1Project(
          pkgJsonContent,
          yarnLockContent,
          {
            includeDevDeps: false,
            includeOptionalDeps: true,
            includePeerDeps: false,
            pruneLevel: 'cycles',
            strictOutOfSync: false,
          },
        );
        const expectedDepGraphJson = JSON.parse(
          readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/real/${fixtureName}/expected.json`,
            ),
            'utf8',
          ),
        );
        const expectedDepGraph = createFromJSON(expectedDepGraphJson);
        expect(newDepGraph.equals(expectedDepGraph)).toBeTruthy();
      });
    });

    // Dev Dep tests
    describe.each(['dev-deps-only', 'empty-dev-deps'])(
      '[dev deps tests] project: %s ',
      (fixtureName) => {
        test('matches expected', async () => {
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/real/${fixtureName}/package.json`,
            ),
            'utf8',
          );
          const yarnLockContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/real/${fixtureName}/yarn.lock`,
            ),
            'utf8',
          );

          const newDepGraphDevDepsIncluded = await parseYarnLockV1Project(
            pkgJsonContent,
            yarnLockContent,
            {
              includeDevDeps: true,
              includeOptionalDeps: true,
              includePeerDeps: false,
              pruneLevel: 'cycles',
              strictOutOfSync: false,
            },
          );

          const newDepGraphDevDepsExcluded = await parseYarnLockV1Project(
            pkgJsonContent,
            yarnLockContent,
            {
              includeDevDeps: false,
              includeOptionalDeps: true,
              includePeerDeps: false,
              pruneLevel: 'cycles',
              strictOutOfSync: false,
            },
          );
          const expectedDepGraphJsonDevIncluded = JSON.parse(
            readFileSync(
              join(
                __dirname,
                `./fixtures/yarn-lock-v1/real/${fixtureName}/expected-dev-deps-included.json`,
              ),
              'utf8',
            ),
          );
          const expectedDepGraphJsonDevExcluded = JSON.parse(
            readFileSync(
              join(
                __dirname,
                `./fixtures/yarn-lock-v1/real/${fixtureName}/expected-dev-deps-excluded.json`,
              ),
              'utf8',
            ),
          );
          const expectedDepGraphDevIncluded = createFromJSON(
            expectedDepGraphJsonDevIncluded,
          );
          const expectedDepGraphDevExcluded = createFromJSON(
            expectedDepGraphJsonDevExcluded,
          );

          expect(
            newDepGraphDevDepsIncluded.equals(expectedDepGraphDevIncluded),
          ).toBeTruthy();
          expect(
            newDepGraphDevDepsExcluded.equals(expectedDepGraphDevExcluded),
          ).toBeTruthy();
        });
      },
    );

    // Cyclic Dep tests
    describe.each(['cyclic-dep', 'cyclic-dep-simple'])(
      '[cycles tests] project: %s ',
      (fixtureName) => {
        test('matches expected', async () => {
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/real/${fixtureName}/package.json`,
            ),
            'utf8',
          );
          const yarnLockContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/real/${fixtureName}/yarn.lock`,
            ),
            'utf8',
          );

          const newDepGraphCyclicDepsPruned = await parseYarnLockV1Project(
            pkgJsonContent,
            yarnLockContent,
            {
              includeDevDeps: false,
              includeOptionalDeps: true,
              includePeerDeps: false,
              pruneLevel: 'cycles',
              strictOutOfSync: false,
            },
          );

          const newDepGraphCyclicDepsUnpruned = await parseYarnLockV1Project(
            pkgJsonContent,
            yarnLockContent,
            {
              includeDevDeps: false,
              includeOptionalDeps: true,
              includePeerDeps: false,
              pruneLevel: 'none',
              strictOutOfSync: false,
            },
          );
          const expectedDepGraphJsonPruned = JSON.parse(
            readFileSync(
              join(
                __dirname,
                `./fixtures/yarn-lock-v1/real/${fixtureName}/expected-cycles-pruned.json`,
              ),
              'utf8',
            ),
          );
          const expectedDepGraphJsonUnpruned = JSON.parse(
            readFileSync(
              join(
                __dirname,
                `./fixtures/yarn-lock-v1/real/${fixtureName}/expected-cycles-not-pruned.json`,
              ),
              'utf8',
            ),
          );
          const expectedDepGraphPruned = createFromJSON(
            expectedDepGraphJsonPruned,
          );
          const expectedDepGraphUnpruned = createFromJSON(
            expectedDepGraphJsonUnpruned,
          );

          expect(
            newDepGraphCyclicDepsPruned.equals(expectedDepGraphPruned),
          ).toBeTruthy();
          expect(
            newDepGraphCyclicDepsUnpruned.equals(expectedDepGraphUnpruned),
          ).toBeTruthy();
        });
      },
    );

    // out-of-sync tests
    describe.each([
      'missing-top-level-deps',
      'missing-non-top-level-deps',
      'missing-top-level-dev-deps',
      'missing-non-top-level-dev-deps',
    ])('[out-of-sync tests] project: %s ', (fixtureName) => {
      test('matches expected', async () => {
        const pkgJsonContent = readFileSync(
          join(
            __dirname,
            `./fixtures/yarn-lock-v1/real/simple-out-of-sync/${fixtureName}/package.json`,
          ),
          'utf8',
        );
        const yarnLockContent = readFileSync(
          join(
            __dirname,
            `./fixtures/yarn-lock-v1/real/simple-out-of-sync/${fixtureName}/yarn.lock`,
          ),
          'utf8',
        );

        const newDepGraph = await parseYarnLockV1Project(
          pkgJsonContent,
          yarnLockContent,
          {
            includeDevDeps: true,
            includeOptionalDeps: true,
            includePeerDeps: false,
            pruneLevel: 'cycles',
            strictOutOfSync: false,
          },
        );

        const expectedDepGraphJson = JSON.parse(
          readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/real/simple-out-of-sync/${fixtureName}/expected.json`,
            ),
            'utf8',
          ),
        );
        const expectedDepGraph = createFromJSON(expectedDepGraphJson);
        expect(newDepGraph.equals(expectedDepGraph)).toBeTruthy();
      });
    });
  });

  describe('Functional / Specific Cases', () => {
    it('missing name in package.json defaults correctly', async () => {
      const fixtureName = 'missing-name-pkg-json';
      const pkgJsonContent = readFileSync(
        join(
          __dirname,
          `./fixtures/yarn-lock-v1/real/${fixtureName}/package.json`,
        ),
        'utf8',
      );
      const yarnLockContent = readFileSync(
        join(
          __dirname,
          `./fixtures/yarn-lock-v1/real/${fixtureName}/yarn.lock`,
        ),
        'utf8',
      );

      const newDepGraph = await parseYarnLockV1Project(
        pkgJsonContent,
        yarnLockContent,
        {
          includeDevDeps: false,
          includeOptionalDeps: true,
          includePeerDeps: false,
          pruneLevel: 'cycles',
          strictOutOfSync: false,
        },
      );
      expect(newDepGraph.rootPkg.name).toBe('package.json');
    });
  });
});

describe('Unhappy path tests', () => {
  it('project: invalid-pkg-json -> fails as expected', async () => {
    const fixtureName = 'invalid-pkg-json';
    const pkgJsonContent = readFileSync(
      join(
        __dirname,
        `./fixtures/yarn-lock-v1/real/${fixtureName}/package.json_content`,
      ),
      'utf8',
    );
    const yarnLockContent = '';

    const nodeMajorVersion = parseInt(
      process.version.substring(1).split('.')[0],
      10,
    );
    const expectedErrorMessage =
      nodeMajorVersion >= 22
        ? 'package.json parsing failed with error Expected double-quoted property name in JSON at position 100 (line 6 column 3)'
        : 'package.json parsing failed with error Unexpected token } in JSON at position 100';

    await expect(
      parseYarnLockV1Project(pkgJsonContent, yarnLockContent, {
        includeDevDeps: false,
        includeOptionalDeps: true,
        includePeerDeps: false,
        pruneLevel: 'cycles',
        strictOutOfSync: false,
      }),
    ).rejects.toThrow(new InvalidUserInputError(expectedErrorMessage));
  });

  it('project: simple-top-level-out-of-sync -> throws OutOfSyncError', async () => {
    const fixtureName = 'missing-top-level-deps';
    const pkgJsonContent = readFileSync(
      join(
        __dirname,
        `./fixtures/yarn-lock-v1/real/simple-out-of-sync/${fixtureName}/package.json`,
      ),
      'utf8',
    );
    const yarnLockContent = readFileSync(
      join(
        __dirname,
        `./fixtures/yarn-lock-v1/real/simple-out-of-sync/${fixtureName}/yarn.lock`,
      ),
      'utf8',
    );
    await expect(
      parseYarnLockV1Project(pkgJsonContent, yarnLockContent, {
        includeDevDeps: false,
        includeOptionalDeps: true,
        includePeerDeps: false,
        pruneLevel: 'cycles',
        strictOutOfSync: true,
      }),
    ).rejects.toThrow(new OutOfSyncError('lodash@4.17.11', LockfileType.yarn));
  });

  it('project: simple-non-top-level-out-of-sync -> throws OutOfSyncError', async () => {
    const fixtureName = 'missing-non-top-level-deps';
    const pkgJsonContent = readFileSync(
      join(
        __dirname,
        `./fixtures/yarn-lock-v1/real/simple-out-of-sync/${fixtureName}/package.json`,
      ),
      'utf8',
    );
    const yarnLockContent = readFileSync(
      join(
        __dirname,
        `./fixtures/yarn-lock-v1/real/simple-out-of-sync/${fixtureName}/yarn.lock`,
      ),
      'utf8',
    );
    await expect(
      parseYarnLockV1Project(pkgJsonContent, yarnLockContent, {
        includeDevDeps: false,
        includeOptionalDeps: true,
        includePeerDeps: false,
        pruneLevel: 'cycles',
        strictOutOfSync: true,
      }),
    ).rejects.toThrow(new OutOfSyncError('ms@0.6.2', LockfileType.yarn));
  });
});
