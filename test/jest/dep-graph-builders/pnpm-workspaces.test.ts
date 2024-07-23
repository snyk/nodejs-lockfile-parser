import { join } from 'path';
import { readFileSync } from 'fs';
import { parsePnpmWorkspace } from '../../../lib/dep-graph-builders';

describe.each(['pnpm-lock-v5', 'pnpm-lock-v6', 'pnpm-lock-v9'])(
  'dep-graph-builder %s',
  (lockFileVersionPath) => {
    describe('[workspaces tests]', () => {
      it('isolated packages in workspaces - test workspace package.json', async () => {
        const fixtureName = 'workspace-with-isolated-pkgs';
        const result = await parsePnpmWorkspace(
          __dirname,
          join(__dirname, `./fixtures/${lockFileVersionPath}/${fixtureName}`),
          {
            includeDevDeps: false,
            includeOptionalDeps: true,
            pruneWithinTopLevelDeps: true,
            strictOutOfSync: false,
          },
        );

        const expectedRootDepGraphJson = JSON.parse(
          readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/expected.json`,
            ),
            'utf8',
          ),
        );

        const expectedBDepGraphJson = JSON.parse(
          readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/packages/pkg-b/expected.json`,
            ),
            'utf8',
          ),
        );

        expect(result[0].targetFile.replace(/\\/g, '/')).toEqual(
          `fixtures/${lockFileVersionPath}/${fixtureName}/package.json`,
        );
        expect(
          Buffer.from(JSON.stringify(result[0].depGraph)).toString('base64'),
        ).toBe(
          Buffer.from(JSON.stringify(expectedRootDepGraphJson)).toString(
            'base64',
          ),
        );

        expect(result[2].targetFile.replace(/\\/g, '/')).toEqual(
          `fixtures/${lockFileVersionPath}/${fixtureName}/packages/pkg-b/package.json`,
        );
        expect(
          Buffer.from(JSON.stringify(result[2].depGraph)).toString('base64'),
        ).toBe(
          Buffer.from(JSON.stringify(expectedBDepGraphJson)).toString('base64'),
        );
      });

      it('cross ref packages in workspaces', async () => {
        const fixtureName = 'workspace-with-cross-ref';
        const result = await parsePnpmWorkspace(
          __dirname,
          join(__dirname, `./fixtures/${lockFileVersionPath}/${fixtureName}`),
          {
            includeDevDeps: false,
            includeOptionalDeps: true,
            pruneWithinTopLevelDeps: true,
            strictOutOfSync: false,
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

        expect(result[2].targetFile.replace(/\\/g, '/')).toEqual(
          `fixtures/${lockFileVersionPath}/${fixtureName}/packages/pkgs/pkg-a/package.json`,
        );
        expect(
          Buffer.from(JSON.stringify(result[2].depGraph)).toString('base64'),
        ).toBe(
          Buffer.from(JSON.stringify(expectedDepGraphJson)).toString('base64'),
        );
      });

      it('undefined versions in cross ref packages in workspaces', async () => {
        const fixtureName = 'workspace-undefined-versions';
        const result = await parsePnpmWorkspace(
          __dirname,
          join(__dirname, `./fixtures/${lockFileVersionPath}/${fixtureName}`),
          {
            includeDevDeps: false,
            includeOptionalDeps: true,
            pruneWithinTopLevelDeps: true,
            strictOutOfSync: false,
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

        expect(result[2].targetFile.replace(/\\/g, '/')).toEqual(
          `fixtures/${lockFileVersionPath}/${fixtureName}/packages/pkgs/pkg-a/package.json`,
        );
        expect(
          Buffer.from(JSON.stringify(result[2].depGraph)).toString('base64'),
        ).toBe(
          Buffer.from(JSON.stringify(expectedDepGraphJson)).toString('base64'),
        );
      });

      it('cyclic workspace projects including root', async () => {
        const fixtureName = 'workspace-cyclic-root';
        const result = await parsePnpmWorkspace(
          __dirname,
          join(__dirname, `./fixtures/${lockFileVersionPath}/${fixtureName}`),
          {
            includeDevDeps: false,
            includeOptionalDeps: true,
            pruneWithinTopLevelDeps: true,
            strictOutOfSync: false,
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

        const expectedSecondDepGraphJson = JSON.parse(
          readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/shared/react/expected.json`,
            ),
            'utf8',
          ),
        );

        expect(result[0].targetFile.replace(/\\/g, '/')).toEqual(
          `fixtures/${lockFileVersionPath}/${fixtureName}/package.json`,
        );
        expect(
          Buffer.from(JSON.stringify(result[0].depGraph)).toString('base64'),
        ).toBe(
          Buffer.from(JSON.stringify(expectedDepGraphJson)).toString('base64'),
        );

        expect(result[1].targetFile.replace(/\\/g, '/')).toEqual(
          `fixtures/${lockFileVersionPath}/${fixtureName}/shared/react/package.json`,
        );
        expect(
          Buffer.from(JSON.stringify(result[1].depGraph)).toString('base64'),
        ).toBe(
          Buffer.from(JSON.stringify(expectedSecondDepGraphJson)).toString(
            'base64',
          ),
        );
      });
      it('cycle in workspace projects starting from the second level projects', async () => {
        const fixtureName = 'workspace-cyclic';
        const result = await parsePnpmWorkspace(
          __dirname,
          join(__dirname, `./fixtures/${lockFileVersionPath}/${fixtureName}`),
          {
            includeDevDeps: true,
            includeOptionalDeps: true,
            includePeerDeps: true,
            pruneWithinTopLevelDeps: true,
            strictOutOfSync: false,
          },
        );

        const expectedRootGraphJson = JSON.parse(
          readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/expected.json`,
            ),
            'utf8',
          ),
        );

        const expectedBackendGraphJson = JSON.parse(
          readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/shared/backend/expected.json`,
            ),
            'utf8',
          ),
        );

        const expectedReactGraphJson = JSON.parse(
          readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/shared/react/expected.json`,
            ),
            'utf8',
          ),
        );

        expect(result[0].targetFile.replace(/\\/g, '/')).toEqual(
          `fixtures/${lockFileVersionPath}/${fixtureName}/package.json`,
        );
        expect(
          Buffer.from(JSON.stringify(result[0].depGraph)).toString('base64'),
        ).toBe(
          Buffer.from(JSON.stringify(expectedRootGraphJson)).toString('base64'),
        );

        expect(result[1].targetFile.replace(/\\/g, '/')).toEqual(
          `fixtures/${lockFileVersionPath}/${fixtureName}/shared/backend/package.json`,
        );
        expect(
          Buffer.from(JSON.stringify(result[1].depGraph)).toString('base64'),
        ).toBe(
          Buffer.from(JSON.stringify(expectedBackendGraphJson)).toString(
            'base64',
          ),
        );

        expect(result[2].targetFile.replace(/\\/g, '/')).toEqual(
          `fixtures/${lockFileVersionPath}/${fixtureName}/shared/react/package.json`,
        );
        expect(
          Buffer.from(JSON.stringify(result[2].depGraph)).toString('base64'),
        ).toBe(
          Buffer.from(JSON.stringify(expectedReactGraphJson)).toString(
            'base64',
          ),
        );
      });
    });
  },
);
