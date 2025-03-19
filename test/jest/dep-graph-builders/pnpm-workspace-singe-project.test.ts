import { join } from 'path';
import { readFileSync } from 'fs';
import { parsePnpmWorkspaceProject } from '../../../lib/dep-graph-builders';

describe.each(['pnpm-lock-v5', 'pnpm-lock-v6', 'pnpm-lock-v9'])(
  'pnpm workspaces dep-graph-builder %s',
  (lockFileVersionPath) => {
    describe('[workspaces tests]', () => {
      it('isolated packages in workspaces - test workspace root package.json', async () => {
        const fixtureName = 'workspace-with-isolated-pkgs';
        const rootPkgJsonContent = readFileSync(
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

        const result = await parsePnpmWorkspaceProject(
          rootPkgJsonContent,
          pkgLockContent,
          {
            includeDevDeps: false,
            includeOptionalDeps: true,
            includePeerDeps: true,
            pruneWithinTopLevelDeps: true,
            strictOutOfSync: true,
          },
          '.',
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

        expect(Buffer.from(JSON.stringify(result)).toString('base64')).toBe(
          Buffer.from(JSON.stringify(expectedRootDepGraphJson)).toString(
            'base64',
          ),
        );
      });

      it('isolated packages in workspaces - test workspace non-root package.json', async () => {
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

        const result = await parsePnpmWorkspaceProject(
          pkgJsonContent,
          pkgLockContent,
          {
            includeDevDeps: false,
            includeOptionalDeps: true,
            includePeerDeps: true,
            pruneWithinTopLevelDeps: true,
            strictOutOfSync: true,
          },
          'packages/pkg-b',
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

        expect(Buffer.from(JSON.stringify(result)).toString('base64')).toBe(
          Buffer.from(JSON.stringify(expectedBDepGraphJson)).toString('base64'),
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

        const result = await parsePnpmWorkspaceProject(
          pkgJsonContent,
          pkgLockContent,
          {
            includeDevDeps: false,
            includeOptionalDeps: true,
            includePeerDeps: true,
            pruneWithinTopLevelDeps: true,
            strictOutOfSync: true,
          },
          'packages/pkgs/pkg-a',
        );

        const expectedDepGraphJson = JSON.parse(
          readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/packages/pkgs/pkg-a/expected-workspace-projects-undefined.json`,
            ),
            'utf8',
          ),
        );

        expect(Buffer.from(JSON.stringify(result)).toString('base64')).toBe(
          Buffer.from(JSON.stringify(expectedDepGraphJson)).toString('base64'),
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

        const result = await parsePnpmWorkspaceProject(
          pkgJsonContent,
          pkgLockContent,
          {
            includeDevDeps: false,
            includeOptionalDeps: true,
            includePeerDeps: true,
            pruneWithinTopLevelDeps: true,
            strictOutOfSync: true,
          },
          'packages/pkgs/pkg-a',
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

        expect(Buffer.from(JSON.stringify(result)).toString('base64')).toBe(
          Buffer.from(JSON.stringify(expectedDepGraphJson)).toString('base64'),
        );
      });

      it('cyclic workspace projects including root', async () => {
        const fixtureName = 'workspace-cyclic-root';
        const rootPkgJsonContent = readFileSync(
          join(
            __dirname,
            `./fixtures/${lockFileVersionPath}/${fixtureName}/package.json`,
          ),
          'utf8',
        );
        const secondPkgJsonContent = readFileSync(
          join(
            __dirname,
            `./fixtures/${lockFileVersionPath}/${fixtureName}/shared/react/package.json`,
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

        const result = await parsePnpmWorkspaceProject(
          rootPkgJsonContent,
          pkgLockContent,
          {
            includeDevDeps: false,
            includeOptionalDeps: true,
            includePeerDeps: true,
            pruneWithinTopLevelDeps: true,
            strictOutOfSync: true,
          },
          '.',
        );

        const expectedDepGraphJson = JSON.parse(
          readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/expected-workspace-projects-undefined.json`,
            ),
            'utf8',
          ),
        );

        expect(Buffer.from(JSON.stringify(result)).toString('base64')).toBe(
          Buffer.from(JSON.stringify(expectedDepGraphJson)).toString('base64'),
        );

        const sharedPkgResult = await parsePnpmWorkspaceProject(
          secondPkgJsonContent,
          pkgLockContent,
          {
            includeDevDeps: false,
            includeOptionalDeps: true,
            includePeerDeps: true,
            pruneWithinTopLevelDeps: true,
            strictOutOfSync: true,
          },
          'shared/react',
        );

        const expectedSecondDepGraphJson = JSON.parse(
          readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/shared/react/expected-workspace-projects-undefined.json`,
            ),
            'utf8',
          ),
        );

        expect(
          Buffer.from(JSON.stringify(sharedPkgResult)).toString('base64'),
        ).toBe(
          Buffer.from(JSON.stringify(expectedSecondDepGraphJson)).toString(
            'base64',
          ),
        );
      });
      it('cycle in workspace projects starting from the second level projects', async () => {
        const fixtureName = 'workspace-cyclic';
        const rootPkgJsonContent = readFileSync(
          join(
            __dirname,
            `./fixtures/${lockFileVersionPath}/${fixtureName}/package.json`,
          ),
          'utf8',
        );
        const backendPkgJsonContent = readFileSync(
          join(
            __dirname,
            `./fixtures/${lockFileVersionPath}/${fixtureName}/shared/backend/package.json`,
          ),
          'utf8',
        );
        const reactPkgJsonContent = readFileSync(
          join(
            __dirname,
            `./fixtures/${lockFileVersionPath}/${fixtureName}/shared/react/package.json`,
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

        const result = await parsePnpmWorkspaceProject(
          rootPkgJsonContent,
          pkgLockContent,
          {
            includeDevDeps: false,
            includeOptionalDeps: true,
            includePeerDeps: true,
            pruneWithinTopLevelDeps: true,
            strictOutOfSync: true,
          },
          '.',
        );

        const expectedRootGraphJson = JSON.parse(
          readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/expected-workspace-projects-undefined.json`,
            ),
            'utf8',
          ),
        );

        expect(Buffer.from(JSON.stringify(result)).toString('base64')).toBe(
          Buffer.from(JSON.stringify(expectedRootGraphJson)).toString('base64'),
        );

        const backendResult = await parsePnpmWorkspaceProject(
          backendPkgJsonContent,
          pkgLockContent,
          {
            includeDevDeps: false,
            includeOptionalDeps: true,
            includePeerDeps: true,
            pruneWithinTopLevelDeps: true,
            strictOutOfSync: true,
          },
          'shared/backend',
        );
        const expectedBackendGraphJson = JSON.parse(
          readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/shared/backend/expected-workspace-projects-undefined.json`,
            ),
            'utf8',
          ),
        );

        expect(
          Buffer.from(JSON.stringify(backendResult)).toString('base64'),
        ).toBe(
          Buffer.from(JSON.stringify(expectedBackendGraphJson)).toString(
            'base64',
          ),
        );

        const reactResult = await parsePnpmWorkspaceProject(
          reactPkgJsonContent,
          pkgLockContent,
          {
            includeDevDeps: false,
            includeOptionalDeps: true,
            includePeerDeps: true,
            pruneWithinTopLevelDeps: true,
            strictOutOfSync: true,
          },
          'shared/react',
        );
        const expectedReactGraphJson = JSON.parse(
          readFileSync(
            join(
              __dirname,
              `./fixtures/${lockFileVersionPath}/${fixtureName}/shared/react/expected-workspace-projects-undefined.json`,
            ),
            'utf8',
          ),
        );

        expect(
          Buffer.from(JSON.stringify(reactResult)).toString('base64'),
        ).toBe(
          Buffer.from(JSON.stringify(expectedReactGraphJson)).toString(
            'base64',
          ),
        );
      });
    });
  },
);

describe('pnpm-lock-v9 catalogs support tests', () => {
  it('returns correctly resolved catalog references', async () => {
    const lockFileVersionPath = 'pnpm-lock-v9';
    const fixtureName = 'workspace-catalogs';

    const rootPkgJsonContent = readFileSync(
      join(
        __dirname,
        `./fixtures/${lockFileVersionPath}/${fixtureName}/package.json`,
      ),
      'utf8',
    );
    const secondPkgJsonContent = readFileSync(
      join(
        __dirname,
        `./fixtures/${lockFileVersionPath}/${fixtureName}/packages/example-components/package.json`,
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

    const result = await parsePnpmWorkspaceProject(
      rootPkgJsonContent,
      pkgLockContent,
      {
        includeDevDeps: false,
        includeOptionalDeps: true,
        includePeerDeps: true,
        pruneWithinTopLevelDeps: true,
        strictOutOfSync: true,
      },
      '.',
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

    const componentResult = await parsePnpmWorkspaceProject(
      secondPkgJsonContent,
      pkgLockContent,
      {
        includeDevDeps: false,
        includeOptionalDeps: true,
        includePeerDeps: true,
        pruneWithinTopLevelDeps: true,
        strictOutOfSync: true,
      },
      'packages/example-components',
    );

    const expectedComponentDepGraphJson = JSON.parse(
      readFileSync(
        join(
          __dirname,
          `./fixtures/${lockFileVersionPath}/${fixtureName}/packages/example-components/expected.json`,
        ),
        'utf8',
      ),
    );

    expect(Buffer.from(JSON.stringify(result)).toString('base64')).toBe(
      Buffer.from(JSON.stringify(expectedRootDepGraphJson)).toString('base64'),
    );

    expect(
      Buffer.from(JSON.stringify(componentResult)).toString('base64'),
    ).toBe(
      Buffer.from(JSON.stringify(expectedComponentDepGraphJson)).toString(
        'base64',
      ),
    );
  });
});
