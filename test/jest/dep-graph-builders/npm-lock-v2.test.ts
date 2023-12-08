import { join } from 'path';
import { readFileSync } from 'fs';
import { parseNpmLockV2Project } from '../../../lib/';
import { createFromJSON } from '@snyk/dep-graph';

describe('dep-graph-builder npm-lock-v2', () => {
  describe('Happy path tests', () => {
    describe('Expected Result tests', () => {
      describe.each([
        'goof',
        'one-dep',
        'cyclic-dep',
        'deeply-nested-packages',
        'deeply-scoped',
        'different-versions',
        'local-pkg-without-workspaces',
        'npm-scoped-sub-dep',
      ])('[simple tests] project: %s ', (fixtureName) => {
        it('matches expected', async () => {
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/npm-lock-v2/${fixtureName}/package.json`,
            ),
            'utf8',
          );
          const pkgLockContent = readFileSync(
            join(
              __dirname,
              `./fixtures/npm-lock-v2/${fixtureName}/package-lock.json`,
            ),
            'utf8',
          );

          const newDepGraph = await parseNpmLockV2Project(
            pkgJsonContent,
            pkgLockContent,
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
                `./fixtures/npm-lock-v2/${fixtureName}/expected.json`,
              ),
              'utf8',
            ),
          );
          const expectedDepGraph = createFromJSON(expectedDepGraphJson);
          expect(newDepGraph.equals(expectedDepGraph)).toBeTruthy();
        });
      });

      describe.each([
        'simple-override',
        'simple-dotted-override',
        'deep-override',
        'override-with-dep',
        'simple-version-range-override',
      ])(
        '[simple tests - needing strictOutOfSync=true] project: %s ',
        (fixtureName) => {
          it('matches expected', async () => {
            const pkgJsonContent = readFileSync(
              join(
                __dirname,
                `./fixtures/npm-lock-v2/${fixtureName}/package.json`,
              ),
              'utf8',
            );
            const pkgLockContent = readFileSync(
              join(
                __dirname,
                `./fixtures/npm-lock-v2/${fixtureName}/package-lock.json`,
              ),
              'utf8',
            );

            const newDepGraph = await parseNpmLockV2Project(
              pkgJsonContent,
              pkgLockContent,
              {
                includeDevDeps: false,
                includeOptionalDeps: true,
                pruneCycles: true,
                strictOutOfSync: true,
              },
            );

            const expectedDepGraphJson = JSON.parse(
              readFileSync(
                join(
                  __dirname,
                  `./fixtures/npm-lock-v2/${fixtureName}/expected.json`,
                ),
                'utf8',
              ),
            );
            const expectedDepGraph = createFromJSON(expectedDepGraphJson);
            expect(newDepGraph.equals(expectedDepGraph)).toBeTruthy();
          });
        },
      );

      describe('[workspaces tests]', () => {
        it('intradependent workspaces', async () => {
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/npm-lock-v2/workspaces/packages/b/package.json`,
            ),
            'utf8',
          );
          const pkgLockContent = readFileSync(
            join(
              __dirname,
              `./fixtures/npm-lock-v2/workspaces/package-lock.json`,
            ),
            'utf8',
          );

          const newDepGraph = await parseNpmLockV2Project(
            pkgJsonContent,
            pkgLockContent,
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
                `./fixtures/npm-lock-v2/workspaces/packages/b/expected.json`,
              ),
              'utf8',
            ),
          );
          const expectedDepGraph = createFromJSON(expectedDepGraphJson);
          expect(newDepGraph.equals(expectedDepGraph)).toBeTruthy();
        });

        it('intradependent workspaces-packages', async () => {
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/npm-lock-v2/workspaces-packages/packages/b/package.json`,
            ),
            'utf8',
          );
          const pkgLockContent = readFileSync(
            join(
              __dirname,
              `./fixtures/npm-lock-v2/workspaces-packages/package-lock.json`,
            ),
            'utf8',
          );

          const newDepGraph = await parseNpmLockV2Project(
            pkgJsonContent,
            pkgLockContent,
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
                `./fixtures/npm-lock-v2/workspaces-packages/packages/b/expected.json`,
              ),
              'utf8',
            ),
          );
          const expectedDepGraph = createFromJSON(expectedDepGraphJson);
          expect(newDepGraph.equals(expectedDepGraph)).toBeTruthy();
        });

        it('intradependent workspaces, with /** globs', async () => {
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/npm-lock-v2/workspaces-glob-a/packages/b/package.json`,
            ),
            'utf8',
          );
          const pkgLockContent = readFileSync(
            join(
              __dirname,
              `./fixtures/npm-lock-v2/workspaces-glob-a/package-lock.json`,
            ),
            'utf8',
          );

          const newDepGraph = await parseNpmLockV2Project(
            pkgJsonContent,
            pkgLockContent,
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
                `./fixtures/npm-lock-v2/workspaces-glob-a/packages/b/expected.json`,
              ),
              'utf8',
            ),
          );
          const expectedDepGraph = createFromJSON(expectedDepGraphJson);
          expect(newDepGraph.equals(expectedDepGraph)).toBeTruthy();
        });

        it('intradependent workspaces, with /* globs', async () => {
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/npm-lock-v2/workspaces-glob-b/packages/b/package.json`,
            ),
            'utf8',
          );
          const pkgLockContent = readFileSync(
            join(
              __dirname,
              `./fixtures/npm-lock-v2/workspaces-glob-b/package-lock.json`,
            ),
            'utf8',
          );

          const newDepGraph = await parseNpmLockV2Project(
            pkgJsonContent,
            pkgLockContent,
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
                `./fixtures/npm-lock-v2/workspaces-glob-b/packages/b/expected.json`,
              ),
              'utf8',
            ),
          );
          const expectedDepGraph = createFromJSON(expectedDepGraphJson);
          expect(newDepGraph.equals(expectedDepGraph)).toBeTruthy();
        });
      });

      // Dev Dep tests
      describe.each(['only-dev-deps', 'empty-dev-deps'])(
        '[dev deps tests] project: %s ',
        (fixtureName) => {
          test('matches expected', async () => {
            const pkgJsonContent = readFileSync(
              join(
                __dirname,
                `./fixtures/npm-lock-v2/${fixtureName}/package.json`,
              ),
              'utf8',
            );
            const npmLockContent = readFileSync(
              join(
                __dirname,
                `./fixtures/npm-lock-v2/${fixtureName}/package-lock.json`,
              ),
              'utf8',
            );

            const newDepGraphDevDepsIncluded = await parseNpmLockV2Project(
              pkgJsonContent,
              npmLockContent,
              {
                includeDevDeps: true,
                includeOptionalDeps: true,
                pruneCycles: true,
                strictOutOfSync: false,
              },
            );

            const newDepGraphDevDepsExcluded = await parseNpmLockV2Project(
              pkgJsonContent,
              npmLockContent,
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
                  `./fixtures/npm-lock-v2/${fixtureName}/expected-dev-deps-included.json`,
                ),
                'utf8',
              ),
            );
            const expectedDepGraphJsonDevExcluded = JSON.parse(
              readFileSync(
                join(
                  __dirname,
                  `./fixtures/npm-lock-v2/${fixtureName}/expected-dev-deps-excluded.json`,
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
    });
  });

  describe('Unhappy path tests', () => {
    it('project: invalid-pkg-json -> fails as expected', async () => {
      const fixtureName = 'invalid-pkg-json';
      const pkgJsonContent = readFileSync(
        join(
          __dirname,
          `./fixtures/npm-lock-v2/${fixtureName}/package.json_content`,
        ),
        'utf8',
      );
      const npmLockContent = '';
      try {
        await parseNpmLockV2Project(pkgJsonContent, npmLockContent, {
          includeDevDeps: false,
          includeOptionalDeps: true,
          pruneCycles: true,
          strictOutOfSync: false,
        });
      } catch (err) {
        expect((err as Error).message).toBe(
          'package.json parsing failed with error Unexpected token } in JSON at position 100',
        );
        expect((err as Error).name).toBe('InvalidUserInputError');
      }
    });

    it('project: simple-non-top-level-out-of-sync -> throws OutOfSyncError', async () => {
      const fixtureName = 'missing-non-top-level-deps';
      const pkgJsonContent = readFileSync(
        join(__dirname, `./fixtures/npm-lock-v2/${fixtureName}/package.json`),
        'utf8',
      );
      const npmLockContent = readFileSync(
        join(
          __dirname,
          `./fixtures/npm-lock-v2/${fixtureName}/package-lock.json`,
        ),
        'utf8',
      );
      try {
        await parseNpmLockV2Project(pkgJsonContent, npmLockContent, {
          includeDevDeps: false,
          includeOptionalDeps: true,
          pruneCycles: true,
          strictOutOfSync: true,
        });
      } catch (err) {
        expect((err as Error).message).toBe(
          'Dependency ms@0.6.2 was not found in package-lock.json. Your package.json and package-lock.json are probably out of sync. Please run "npm install" and try again.',
        );
        expect((err as Error).name).toBe('OutOfSyncError');
      }
    });

    it('project: simple-top-level-out-of-sync -> throws OutOfSyncError', async () => {
      const fixtureName = 'missing-top-level-deps';
      const pkgJsonContent = readFileSync(
        join(__dirname, `./fixtures/npm-lock-v2/${fixtureName}/package.json`),
        'utf8',
      );
      const npmLockContent = readFileSync(
        join(
          __dirname,
          `./fixtures/npm-lock-v2/${fixtureName}/package-lock.json`,
        ),
        'utf8',
      );
      try {
        await parseNpmLockV2Project(pkgJsonContent, npmLockContent, {
          includeDevDeps: false,
          includeOptionalDeps: true,
          pruneCycles: true,
          strictOutOfSync: true,
        });
      } catch (err) {
        expect((err as Error).message).toBe(
          'Dependency lodash@4.17.11 was not found in package-lock.json. Your package.json and package-lock.json are probably out of sync. Please run "npm install" and try again.',
        );
        expect((err as Error).name).toBe('OutOfSyncError');
      }
    });
  });
});

describe('bundledDependencies', () => {
  it('project: bundled-deps resolves dep-graph', async () => {
    const fixtureName = 'bundled-deps';
    const pkgJsonContent = readFileSync(
      join(__dirname, `./fixtures/npm-lock-v2/${fixtureName}/package.json`),
      'utf8',
    );
    const npmLockContent = readFileSync(
      join(
        __dirname,
        `./fixtures/npm-lock-v2/${fixtureName}/package-lock.json`,
      ),
      'utf8',
    );
    const depGraph = await parseNpmLockV2Project(
      pkgJsonContent,
      npmLockContent,
      {
        includeDevDeps: false,
        includeOptionalDeps: true,
        pruneCycles: true,
        strictOutOfSync: true,
      },
    );
    const expectedDepGraphJson = JSON.parse(
      readFileSync(
        join(__dirname, `./fixtures/npm-lock-v2/${fixtureName}/expected.json`),
        'utf8',
      ),
    );
    const expectedDepGraph = createFromJSON(expectedDepGraphJson);
    expect(depGraph.equals(expectedDepGraph)).toBeTruthy();
  });
});
