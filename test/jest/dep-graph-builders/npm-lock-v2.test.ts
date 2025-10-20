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
        'nested-bundled-deps',
        'root-level-bundled',
        'alias-with-nested-deps',
        'goof',
        'one-dep',
        'cyclic-dep',
        'deeply-nested-packages',
        'deeply-scoped',
        'different-versions',
        'local-pkg-without-workspaces',
        'dist-tag-sub-dependency',
        'bundled-top-level-dep',
        'missing-optional-dep-minimal',
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
              strictOutOfSync: true,
              honorAliases: true,
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

      const nodeMajorVersion = parseInt(
        process.version.substring(1).split('.')[0],
        10,
      );
      const expectedErrorMessage =
        nodeMajorVersion >= 22
          ? 'package.json parsing failed with error Expected double-quoted property name in JSON at position 100 (line 6 column 3)'
          : 'package.json parsing failed with error Unexpected token } in JSON at position 100';

      await expect(
        parseNpmLockV2Project(pkgJsonContent, npmLockContent, {
          includeDevDeps: false,
          includeOptionalDeps: true,
          pruneCycles: true,
          strictOutOfSync: false,
        }),
      ).rejects.toThrow(new InvalidUserInputError(expectedErrorMessage));
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

    it('should throw error on out of sync with prune ff', async () => {
      const fixtureName = 'simple-out-of-sync';
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
          pruneNpmStrictOutOfSync: true,
        }),
      ).rejects.toThrow(new OutOfSyncError('lodash@4.17.21', LockfileType.npm));
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

  it('project: bundled-deps-wasm handles WASM packages with bundled dependencies', async () => {
    const fixtureName = 'bundled-deps-wasm';
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

    // This should NOT throw OutOfSyncError even though bundled deps
    // are not listed as separate entries in the lockfile
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

    expect(depGraph).toBeDefined();
    expect(depGraph.getPkgs().length).toBeGreaterThan(0);

    const depGraphJson = depGraph.toJSON();
    const wasmPkg = depGraphJson.pkgs.find(
      (p) => p.info.name === '@tailwindcss/oxide-wasm32-wasi',
    );
    expect(wasmPkg).toBeDefined();
    expect(wasmPkg?.info.version).toBe('4.1.11');

    // Verify bundled dependencies are in the graph as children
    const wasmNode = depGraphJson.graph.nodes.find(
      (n) => n.pkgId === wasmPkg?.id,
    );
    expect(wasmNode).toBeDefined();

    expect(wasmNode?.deps.length).toBeGreaterThan(0);

    // Check for one of the bundled dependencies
    const emnapiCoreDep = wasmNode?.deps.find((d) =>
      d.nodeId.includes('@emnapi/core'),
    );
    expect(emnapiCoreDep).toBeDefined();
  });
});
