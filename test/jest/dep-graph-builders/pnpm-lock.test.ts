import { join } from 'path';
import { readFileSync } from 'fs';
import { parsePnpmProject } from '../../../lib/dep-graph-builders';
import { OpenSourceEcosystems } from '@snyk/error-catalog-nodejs-public';
import { InvalidUserInputError } from '../../../lib';

describe.each(['pnpm-lock-v5', 'pnpm-lock-v6', 'pnpm-lock-v9'])(
  'pnpm dep-graph-builder %s',
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
          'alias-sub-dependency',
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
                strictOutOfSync: true,
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
        it('peer dependencies are included if in options', async () => {
          const fixtureName = 'peer-dependencies';
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
              includePeerDeps: true,
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
        await expect(
          parsePnpmProject(pkgJsonContent, pnpmLockContent, {
            includeDevDeps: false,
            includeOptionalDeps: true,
            pruneWithinTopLevelDeps: true,
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
        await expect(
          parsePnpmProject(pkgJsonContent, pnpmLockContent, {
            includeDevDeps: false,
            includeOptionalDeps: true,
            pruneWithinTopLevelDeps: true,
            strictOutOfSync: true,
          }),
        ).rejects.toThrow(
          new OpenSourceEcosystems.PnpmOutOfSyncError(
            'Dependency ms@0.6.2 was not found in pnpm-lock.yaml. Your package.json and pnpm-lock.yaml are probably out of sync. Please run "pnpm install" and try again.',
          ),
        );
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
        await expect(
          parsePnpmProject(pkgJsonContent, pnpmLockContent, {
            includeDevDeps: false,
            includeOptionalDeps: true,
            pruneWithinTopLevelDeps: true,
            strictOutOfSync: true,
          }),
        ).rejects.toThrow(
          new OpenSourceEcosystems.PnpmOutOfSyncError(
            'Dependency lodash was not found in pnpm-lock.yaml. Your package.json and pnpm-lock.yaml are probably out of sync. Please run "pnpm install" and try again.',
          ),
        );
      });
    });
  },
);
