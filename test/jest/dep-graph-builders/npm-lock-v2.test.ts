import { join } from 'path';
import { readFileSync } from 'fs';
import {
  InvalidUserInputError,
  LockfileType,
  OutOfSyncError,
  parseNpmLockV2Project,
} from '../../../lib/';

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
        'dist-tag-sub-dependency',
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

          expect(
            Buffer.from(JSON.stringify(newDepGraph)).toString('base64'),
          ).toBe(
            Buffer.from(JSON.stringify(expectedDepGraphJson)).toString(
              'base64',
            ),
          );
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
            expect(
              Buffer.from(JSON.stringify(newDepGraph)).toString('base64'),
            ).toBe(
              Buffer.from(JSON.stringify(expectedDepGraphJson)).toString(
                'base64',
              ),
            );
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
          expect(
            Buffer.from(JSON.stringify(newDepGraph)).toString('base64'),
          ).toBe(
            Buffer.from(JSON.stringify(expectedDepGraphJson)).toString(
              'base64',
            ),
          );
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
          expect(
            Buffer.from(JSON.stringify(newDepGraph)).toString('base64'),
          ).toBe(
            Buffer.from(JSON.stringify(expectedDepGraphJson)).toString(
              'base64',
            ),
          );
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
          expect(
            Buffer.from(JSON.stringify(newDepGraph)).toString('base64'),
          ).toBe(
            Buffer.from(JSON.stringify(expectedDepGraphJson)).toString(
              'base64',
            ),
          );
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
          expect(
            Buffer.from(JSON.stringify(newDepGraph)).toString('base64'),
          ).toBe(
            Buffer.from(JSON.stringify(expectedDepGraphJson)).toString(
              'base64',
            ),
          );
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

            expect(
              Buffer.from(JSON.stringify(newDepGraphDevDepsIncluded)).toString(
                'base64',
              ),
            ).toBe(
              Buffer.from(
                JSON.stringify(expectedDepGraphJsonDevIncluded),
              ).toString('base64'),
            );

            expect(
              Buffer.from(JSON.stringify(newDepGraphDevDepsExcluded)).toString(
                'base64',
              ),
            ).toBe(
              Buffer.from(
                JSON.stringify(expectedDepGraphJsonDevExcluded),
              ).toString('base64'),
            );
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
      await expect(
        parseNpmLockV2Project(pkgJsonContent, npmLockContent, {
          includeDevDeps: false,
          includeOptionalDeps: true,
          pruneCycles: true,
          strictOutOfSync: false,
        }),
      ).rejects.toThrow(
        new InvalidUserInputError(
          'package.json parsing failed with error Unexpected token } in JSON at position 100',
        ),
      );
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
      await expect(
        parseNpmLockV2Project(pkgJsonContent, npmLockContent, {
          includeDevDeps: false,
          includeOptionalDeps: true,
          pruneCycles: true,
          strictOutOfSync: true,
        }),
      ).rejects.toThrow(new OutOfSyncError('ms@0.6.2', LockfileType.npm));
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
      await expect(
        parseNpmLockV2Project(pkgJsonContent, npmLockContent, {
          includeDevDeps: false,
          includeOptionalDeps: true,
          pruneCycles: true,
          strictOutOfSync: true,
        }),
      ).rejects.toThrow(new OutOfSyncError('lodash@4.17.11', LockfileType.npm));
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
    expect(Buffer.from(JSON.stringify(depGraph)).toString('base64')).toBe(
      Buffer.from(JSON.stringify(expectedDepGraphJson)).toString('base64'),
    );
  });
});
