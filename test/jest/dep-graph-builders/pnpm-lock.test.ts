import { join } from 'path';
import { readFileSync } from 'fs';
import { parsePnpmProject } from '../../../lib/dep-graph-builders';
import { NodeLockfileVersion } from '../../../lib/utils';

const LOCK_FILE_VERSIONS = {
  'pnpm-lock-v6': NodeLockfileVersion.PnpmLockV6,
  'pnpm-lock-v5': NodeLockfileVersion.PnpmLockV5,
  'pnpm-lock-v9': NodeLockfileVersion.PnpmLockV9,
};
describe.each(['pnpm-lock-v5', 'pnpm-lock-v6', 'pnpm-lock-v9'])(
  'dep-graph-builder %s',
  (lockFileVersionPath) => {
    describe('Happy path tests', () => {
      describe('Expected Result tests', () => {
        describe.each([
          'goof',
          'one-dep',
          'cyclic-dep',
          // 'deeply-nested-packages',
          'deeply-scoped',
          'different-versions',
          'local-pkg-without-workspaces',
          // 'dist-tag-sub-dependency',
          'external-tarball',
          'git-ssh-url-deps',
          'simple-override',
          'npm-protocol',
          'scoped-override',
        ])('[simple tests] project: %s ', (fixtureName) => {
          jest.setTimeout(50 * 1000);
          it('matches expected', async () => {
            const pkgJsonContent = readFileSync(
              join(
                __dirname,
                `./fixtures/${lockFileVersionPath}/${fixtureName}/package.json`,
              ),
              'utf8',
            );
            const pkgLockContent = readFileSync(
              join(
                __dirname,
                `./fixtures/${lockFileVersionPath}/${fixtureName}/pnpm-lock.yaml`,
              ),
              'utf8',
            );

            const newDepGraph = await parsePnpmProject(
              pkgJsonContent,
              pkgLockContent,
              {
                includeDevDeps: false,
                includeOptionalDeps: false,
                strictOutOfSync: false,
                pruneWithinTopLevelDeps: false,
              },
            );

            const expectedDepGraphJson = JSON.parse(
              readFileSync(
                join(
                  __dirname,
                  `./fixtures/${lockFileVersionPath}/${fixtureName}/expected.json`,
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
      });

      describe('[workspaces tests]', () => {
        it('isolated packages in workspaces - test workspace package.json', async () => {
          const fixtureName = 'workspace-with-isolated-pkgs';
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/packages/pkg-b/package.json`,
            ),
            'utf8',
          );
          const pkgLockContent = readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/pnpm-lock.yaml`,
            ),
            'utf8',
          );
          const newDepGraph = await parsePnpmProject(
            pkgJsonContent,
            pkgLockContent,
            {
              includeDevDeps: false,
              includeOptionalDeps: true,
              pruneWithinTopLevelDeps: true,
              strictOutOfSync: false,
            },
            LOCK_FILE_VERSIONS[lockFileVersionPath],
            {
              isWorkspacePkg: true,
              isRoot: false,
              workspacePath: 'packages/pkg-b',
              projectsVersionMap: {},
              rootOverrides: {},
            },
          );
          const expectedDepGraphJson = JSON.parse(
            readFileSync(
              join(
                __dirname,
                `./fixtures/${lockFileVersionPath}/${fixtureName}/packages/pkg-b/expected.json`,
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
        it('isolated packages in workspaces - test root package.json', async () => {
          const fixtureName = 'workspace-with-isolated-pkgs';
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/package.json`,
            ),
            'utf8',
          );
          const pkgLockContent = readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/pnpm-lock.yaml`,
            ),
            'utf8',
          );
          const newDepGraph = await parsePnpmProject(
            pkgJsonContent,
            pkgLockContent,
            {
              includeDevDeps: false,
              includeOptionalDeps: true,
              pruneWithinTopLevelDeps: true,
              strictOutOfSync: false,
            },
            LOCK_FILE_VERSIONS[lockFileVersionPath],
            {
              isWorkspacePkg: true,
              isRoot: true,
              workspacePath: '.',
              projectsVersionMap: {},
              rootOverrides: {},
            },
          );
          const expectedDepGraphJson = JSON.parse(
            readFileSync(
              join(
                __dirname,
                `./fixtures/${lockFileVersionPath}/${fixtureName}/expected.json`,
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
        it('cross ref packages in workspaces', async () => {
          const fixtureName = 'workspace-with-cross-ref';
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/packages/pkgs/pkg-a/package.json`,
            ),
            'utf8',
          );
          const pkgLockContent = readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/pnpm-lock.yaml`,
            ),
            'utf8',
          );
          const newDepGraph = await parsePnpmProject(
            pkgJsonContent,
            pkgLockContent,
            {
              includeDevDeps: false,
              includeOptionalDeps: true,
              pruneWithinTopLevelDeps: true,
              strictOutOfSync: false,
            },
            LOCK_FILE_VERSIONS[lockFileVersionPath],
            {
              isWorkspacePkg: true,
              isRoot: false,
              workspacePath: 'packages/pkgs/pkg-a',
              projectsVersionMap: {
                '.': '1.0.0',
                'packages/pkgs/pkg-a': '1.0.0',
                'packages/pkgs/pkg-b': '1.0.0',
                'other-packages/pkg-c': '1.0.0',
              },
              rootOverrides: {},
            },
          );
          const expectedDepGraphJson = JSON.parse(
            readFileSync(
              join(
                __dirname,
                `./fixtures/${lockFileVersionPath}/${fixtureName}/packages/pkgs/pkg-a/expected.json`,
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

        it('undefined versions in cross ref packages in workspaces', async () => {
          const fixtureName = 'workspace-undefined-versions';
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/packages/pkgs/pkg-a/package.json`,
            ),
            'utf8',
          );
          const pkgLockContent = readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/pnpm-lock.yaml`,
            ),
            'utf8',
          );
          const newDepGraph = await parsePnpmProject(
            pkgJsonContent,
            pkgLockContent,
            {
              includeDevDeps: false,
              includeOptionalDeps: true,
              pruneWithinTopLevelDeps: true,
              strictOutOfSync: false,
            },
            LOCK_FILE_VERSIONS[lockFileVersionPath],
            {
              isWorkspacePkg: true,
              isRoot: false,
              workspacePath: 'packages/pkgs/pkg-a',
              projectsVersionMap: {
                '.': '1.0.0',
              },
              rootOverrides: {},
            },
          );
          const expectedDepGraphJson = JSON.parse(
            readFileSync(
              join(
                __dirname,
                `./fixtures/${lockFileVersionPath}/${fixtureName}/packages/pkgs/pkg-a/expected.json`,
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

        // Dev Dep tests
        describe.each(['only-dev-deps', 'empty-dev-deps'])(
          '[dev deps tests] project: %s ',
          (fixtureName) => {
            test('matches expected', async () => {
              const pkgJsonContent = readFileSync(
                join(
                  __dirname,
                  `./fixtures/${lockFileVersionPath}/${fixtureName}/package.json`,
                ),
                'utf8',
              );
              const pnpmLockContent = readFileSync(
                join(
                  __dirname,
                  `./fixtures/${lockFileVersionPath}/${fixtureName}/pnpm-lock.yaml`,
                ),
                'utf8',
              );
              const newDepGraphDevDepsIncluded = await parsePnpmProject(
                pkgJsonContent,
                pnpmLockContent,
                {
                  includeDevDeps: true,
                  includeOptionalDeps: true,
                  pruneWithinTopLevelDeps: true,
                  strictOutOfSync: false,
                },
              );
              const newDepGraphDevDepsExcluded = await parsePnpmProject(
                pkgJsonContent,
                pnpmLockContent,
                {
                  includeDevDeps: false,
                  includeOptionalDeps: true,
                  pruneWithinTopLevelDeps: true,
                  strictOutOfSync: false,
                },
              );
              const expectedDepGraphJsonDevIncluded = JSON.parse(
                readFileSync(
                  join(
                    __dirname,
                    `./fixtures/${lockFileVersionPath}/${fixtureName}/expected-dev-deps-included.json`,
                  ),
                  'utf8',
                ),
              );
              const expectedDepGraphJsonDevExcluded = JSON.parse(
                readFileSync(
                  join(
                    __dirname,
                    `./fixtures/${lockFileVersionPath}/${fixtureName}/expected-dev-deps-excluded.json`,
                  ),
                  'utf8',
                ),
              );

              expect(
                Buffer.from(
                  JSON.stringify(newDepGraphDevDepsIncluded),
                ).toString('base64'),
              ).toBe(
                Buffer.from(
                  JSON.stringify(expectedDepGraphJsonDevIncluded),
                ).toString('base64'),
              );

              expect(
                Buffer.from(
                  JSON.stringify(newDepGraphDevDepsExcluded),
                ).toString('base64'),
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
            `./fixtures/${lockFileVersionPath}/${fixtureName}/package.json_content`,
          ),
          'utf8',
        );
        const pnpmLockContent = '';
        try {
          await parsePnpmProject(pkgJsonContent, pnpmLockContent, {
            includeDevDeps: false,
            includeOptionalDeps: true,
            pruneWithinTopLevelDeps: true,
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
          join(
            __dirname,
            `./fixtures/${lockFileVersionPath}/${fixtureName}/package.json`,
          ),
          'utf8',
        );
        const pnpmLockContent = readFileSync(
          join(
            __dirname,
            `./fixtures/${lockFileVersionPath}/${fixtureName}/pnpm-lock.yaml`,
          ),
          'utf8',
        );
        try {
          await parsePnpmProject(pkgJsonContent, pnpmLockContent, {
            includeDevDeps: false,
            includeOptionalDeps: true,
            pruneWithinTopLevelDeps: true,
            strictOutOfSync: true,
          });
        } catch (err) {
          expect((err as Error).message).toBe(
            'Dependency ms@0.6.2 was not found in pnpm-lock.yaml. Your package.json and pnpm-lock.yaml are probably out of sync. Please run "pnpm install" and try again.',
          );
          expect((err as Error).name).toBe('OutOfSyncError');
        }
      });
      it('project: simple-top-level-out-of-sync -> throws OutOfSyncError', async () => {
        const fixtureName = 'missing-top-level-deps';
        const pkgJsonContent = readFileSync(
          join(
            __dirname,
            `./fixtures/${lockFileVersionPath}/${fixtureName}/package.json`,
          ),
          'utf8',
        );
        const pnpmLockContent = readFileSync(
          join(
            __dirname,
            `./fixtures/${lockFileVersionPath}/${fixtureName}/pnpm-lock.yaml`,
          ),
          'utf8',
        );
        try {
          await parsePnpmProject(pkgJsonContent, pnpmLockContent, {
            includeDevDeps: false,
            includeOptionalDeps: true,
            pruneWithinTopLevelDeps: true,
            strictOutOfSync: true,
          });
        } catch (err) {
          expect((err as Error).message).toBe(
            'Dependency lodash@4.17.11 was not found in pnpm-lock.yaml. Your package.json and pnpm-lock.yaml are probably out of sync. Please run "pnpm install" and try again.',
          );
          expect((err as Error).name).toBe('OutOfSyncError');
        }
      });
    });
  },
);
