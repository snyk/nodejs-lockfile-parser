import { join } from 'path';
<<<<<<< HEAD
import { readFileSync } from 'fs';
import { legacy } from '@snyk/dep-graph';

import {
  parseYarnLockV1Project,
  buildDepTree,
  LockfileType,
  parseYarnLockV1WorkspaceProject,
} from '../../../lib';

describe('dep-graph-builder yarn-lock-v1', () => {
  describe.each([
    'one-dep',
    'cyclic-dep-simple',
    'goof',
    'external-tarball',
    // 'asdasdasdasdasdasdasd',
  ])('project: %s [non-workspace]', (fixtureName) => {
    test('regression against tree build', async () => {
      const pkgJsonContent = readFileSync(
        join(__dirname, `./fixtures/yarn-lock-v1/${fixtureName}/package.json`),
        'utf8',
      );

      const yarnLockContent = readFileSync(
        join(__dirname, `./fixtures/yarn-lock-v1/${fixtureName}/yarn.lock`),
        'utf8',
      );
      const newDepGraph = await parseYarnLockV1Project(
        pkgJsonContent,
        yarnLockContent,
      );
      const oldDepTree = await buildDepTree(
        pkgJsonContent,
        yarnLockContent,
        undefined,
        LockfileType.yarn,
      );
      const oldDepGraph = await legacy.depTreeToGraph(oldDepTree, 'yarn');
      expect(newDepGraph.equals(oldDepGraph)).toBeTruthy();
    });
  });

  describe.each(['yarn-1-workspace-with-cross-ref'])(
    'project: %s [workspace]',
    (fixtureName) => {
      test('It actually works', async () => {
        const yarnLockContent = readFileSync(
          join(__dirname, `./fixtures/yarn-lock-v1/${fixtureName}/yarn.lock`),
          'utf8',
        );
        const rootPkgJsonContent = readFileSync(
=======
import { readFileSync, writeFileSync } from 'fs';
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
        'git-ssh-url-deps',
        'npm-protocol',
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
              },
            );

            const newDepGraphDevDepsExcluded = await parseYarnLockV1Project(
              pkgJsonContent,
              yarnLockContent,
              {
                includeDevDeps: false,
                includeOptionalDeps: true,
                pruneCycles: true,
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
              },
            );

            const newDepGraphCyclicDepsUnpruned = await parseYarnLockV1Project(
              pkgJsonContent,
              yarnLockContent,
              {
                includeDevDeps: false,
                includeOptionalDeps: true,
                pruneCycles: false,
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
>>>>>>> 535a5cb (tests: a number of new tests)
          join(
            __dirname,
            `./fixtures/yarn-lock-v1/${fixtureName}/package.json`,
          ),
          'utf8',
        );
<<<<<<< HEAD
        const pkgAPkgJsonContent = readFileSync(
          join(
            __dirname,
            `./fixtures/yarn-lock-v1/${fixtureName}/packages/pkg-a/package.json`,
          ),
          'utf8',
        );
        const pkgBPkgJsonContent = readFileSync(
          join(
            __dirname,
            `./fixtures/yarn-lock-v1/${fixtureName}/packages/pkg-b/package.json`,
          ),
          'utf8',
        );

        const newDepGraphs = await parseYarnLockV1WorkspaceProject(
          yarnLockContent,
          [rootPkgJsonContent, pkgAPkgJsonContent, pkgBPkgJsonContent],
        );
        expect(newDepGraphs).toBeTruthy();
      });
    },
  );
=======
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
          },
        );
        expect(newDepGraph.rootPkg.name).toBe('package.json');
      });
    });
  });

  describe('Unhappy path', () => {
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
        });
      } catch (err) {
        expect(err.message).toBe(
          'package.json parsing failed with error Unexpected token } in JSON at position 100',
        );
        expect(err.name).toBe('InvalidUserInputError');
      }
    });
  });
>>>>>>> 535a5cb (tests: a number of new tests)
});
