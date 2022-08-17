import { join } from 'path';
import { readFileSync } from 'fs';
import { createFromJSON } from '@snyk/dep-graph';
import { parseYarnLockV1Project } from '../../../lib';

describe('dep-graph-builder yarn-lock-v1', () => {
  describe('happy path tests', () => {
    describe('Expected Result tests', () => {
      describe.each([
        'one-dep',
        'goof',
        'external-tarball',
        'file-as-version',
        'file-as-version-no-lock-entry',
        'git-ssh-url-deps',
        'npm-protocol',
        'simple-top-level-out-of-sync',
        'lock-file-deps-out-of-sync',
      ])('[simple tests] project: %s ', (fixtureName) => {
        test('matches expected', async () => {
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v1/${fixtureName}/package.json`,
            ),
            'utf8',
          );
          const yarnLockContent = readFileSync(
            join(__dirname, `./fixtures/yarn-lock-v1/${fixtureName}/yarn.lock`),
            'utf8',
          );

          const newDepGraph = await parseYarnLockV1Project(
            pkgJsonContent,
            yarnLockContent,
            {
              includeDevDeps: false,
              includeOptionalDeps: true,
              pruneCycles: true,
              strictOutOfSync: false,
            },
          );
          const expectedDepGraphJson = JSON.parse(
            readFileSync(
              join(
                __dirname,
                `./fixtures/yarn-lock-v1/${fixtureName}/expected.json`,
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
                `./fixtures/yarn-lock-v1/${fixtureName}/package.json`,
              ),
              'utf8',
            );
            const yarnLockContent = readFileSync(
              join(
                __dirname,
                `./fixtures/yarn-lock-v1/${fixtureName}/yarn.lock`,
              ),
              'utf8',
            );

            const newDepGraphDevDepsIncluded = await parseYarnLockV1Project(
              pkgJsonContent,
              yarnLockContent,
              {
                includeDevDeps: true,
                includeOptionalDeps: true,
                pruneCycles: true,
                strictOutOfSync: false,
              },
            );

            const newDepGraphDevDepsExcluded = await parseYarnLockV1Project(
              pkgJsonContent,
              yarnLockContent,
              {
                includeDevDeps: false,
                includeOptionalDeps: true,
                pruneCycles: true,
                strictOutOfSync: false,
              },
            );
            const expectedDepGraphJsonDevIncluded = JSON.parse(
              readFileSync(
                join(
                  __dirname,
                  `./fixtures/yarn-lock-v1/${fixtureName}/expected-dev-deps-included.json`,
                ),
                'utf8',
              ),
            );
            const expectedDepGraphJsonDevExcluded = JSON.parse(
              readFileSync(
                join(
                  __dirname,
                  `./fixtures/yarn-lock-v1/${fixtureName}/expected-dev-deps-excluded.json`,
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
                `./fixtures/yarn-lock-v1/${fixtureName}/package.json`,
              ),
              'utf8',
            );
            const yarnLockContent = readFileSync(
              join(
                __dirname,
                `./fixtures/yarn-lock-v1/${fixtureName}/yarn.lock`,
              ),
              'utf8',
            );

            const newDepGraphCyclicDepsPruned = await parseYarnLockV1Project(
              pkgJsonContent,
              yarnLockContent,
              {
                includeDevDeps: false,
                includeOptionalDeps: true,
                pruneCycles: true,
                strictOutOfSync: false,
              },
            );

            const newDepGraphCyclicDepsUnpruned = await parseYarnLockV1Project(
              pkgJsonContent,
              yarnLockContent,
              {
                includeDevDeps: false,
                includeOptionalDeps: true,
                pruneCycles: false,
                strictOutOfSync: false,
              },
            );
            const expectedDepGraphJsonPruned = JSON.parse(
              readFileSync(
                join(
                  __dirname,
                  `./fixtures/yarn-lock-v1/${fixtureName}/expected-cycles-pruned.json`,
                ),
                'utf8',
              ),
            );
            const expectedDepGraphJsonUnpruned = JSON.parse(
              readFileSync(
                join(
                  __dirname,
                  `./fixtures/yarn-lock-v1/${fixtureName}/expected-cycles-not-pruned.json`,
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
    });

    describe('Functional / Specific Cases', () => {
      it('missing name in package.json defaults correctly', async () => {
        const fixtureName = 'missing-name-pkg-json';
        const pkgJsonContent = readFileSync(
          join(
            __dirname,
            `./fixtures/yarn-lock-v1/${fixtureName}/package.json`,
          ),
          'utf8',
        );
        const yarnLockContent = readFileSync(
          join(__dirname, `./fixtures/yarn-lock-v1/${fixtureName}/yarn.lock`),
          'utf8',
        );

        const newDepGraph = await parseYarnLockV1Project(
          pkgJsonContent,
          yarnLockContent,
          {
            includeDevDeps: false,
            includeOptionalDeps: true,
            pruneCycles: true,
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
          `./fixtures/yarn-lock-v1/${fixtureName}/package.json_content`,
        ),
        'utf8',
      );
      const yarnLockContent = '';
      try {
        await parseYarnLockV1Project(pkgJsonContent, yarnLockContent, {
          includeDevDeps: false,
          includeOptionalDeps: true,
          pruneCycles: true,
          strictOutOfSync: false,
        });
      } catch (err) {
        expect(err.message).toBe(
          'package.json parsing failed with error Unexpected token } in JSON at position 100',
        );
        expect(err.name).toBe('InvalidUserInputError');
      }
    });

    it('project: simple-top-level-out-of-sync -> throws OutOfSyncError', async () => {
      const fixtureName = 'simple-top-level-out-of-sync';
      const pkgJsonContent = readFileSync(
        join(__dirname, `./fixtures/yarn-lock-v1/${fixtureName}/package.json`),
        'utf8',
      );
      const yarnLockContent = readFileSync(
        join(__dirname, `./fixtures/yarn-lock-v1/${fixtureName}/yarn.lock`),
        'utf8',
      );
      try {
        await parseYarnLockV1Project(pkgJsonContent, yarnLockContent, {
          includeDevDeps: false,
          includeOptionalDeps: true,
          pruneCycles: true,
          strictOutOfSync: true,
        });
      } catch (err) {
        expect(err.message).toBe(
          'Dependency lodash@4.17.11 was not found in yarn.lock. Your package.json and yarn.lock are probably out of sync. Please run "yarn install" and try again.',
        );
        expect(err.name).toBe('OutOfSyncError');
      }
    });

    it('project: lock-file-deps-out-of-sync -> throws OutOfSyncError', async () => {
      const fixtureName = 'lock-file-deps-out-of-sync';
      const pkgJsonContent = readFileSync(
        join(__dirname, `./fixtures/yarn-lock-v1/${fixtureName}/package.json`),
        'utf8',
      );
      const yarnLockContent = readFileSync(
        join(__dirname, `./fixtures/yarn-lock-v1/${fixtureName}/yarn.lock`),
        'utf8',
      );
      try {
        await parseYarnLockV1Project(pkgJsonContent, yarnLockContent, {
          includeDevDeps: false,
          includeOptionalDeps: true,
          pruneCycles: true,
          strictOutOfSync: true,
        });
      } catch (err) {
        expect(err.message).toBe(
          'Dependency ms@0.6.2 was not found in yarn.lock. Your package.json and yarn.lock are probably out of sync. Please run "yarn install" and try again.',
        );
        expect(err.name).toBe('OutOfSyncError');
      }
    });
  });
});
