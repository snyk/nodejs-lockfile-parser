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
        'workspace-nested-deps',
        'nested-non-alias-with-top-level-alias',
        'transitive-resolves-to-alias',
        'transitive-peer-deps',
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
          : nodeMajorVersion >= 20
          ? 'package.json parsing failed with error Expected double-quoted property name in JSON at position 100'
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

describe('peerDependencies', () => {
  const loadFixture = (fixtureName: string) => ({
    pkgJsonContent: readFileSync(
      join(__dirname, `./fixtures/npm-lock-v2/${fixtureName}/package.json`),
      'utf8',
    ),
    npmLockContent: readFileSync(
      join(
        __dirname,
        `./fixtures/npm-lock-v2/${fixtureName}/package-lock.json`,
      ),
      'utf8',
    ),
  });

  const parseTransitivePeerDeps = () => {
    const { pkgJsonContent, npmLockContent } = loadFixture(
      'transitive-peer-deps',
    );
    return parseNpmLockV2Project(pkgJsonContent, npmLockContent, {
      includeDevDeps: false,
      includeOptionalDeps: true,
      pruneCycles: true,
      strictOutOfSync: true,
    });
  };

  // npm v7+ installs peer dependencies by default and records them in the
  // lockfile. A peer dependency of a (transitive) dependency must therefore be
  // included in the dep graph, not just peers declared on the root package.
  // The chain here also covers a peer-of-a-peer: minimatch (a peer of
  // lib-with-peer) itself peers brace-expansion.
  it('includes the peer dependencies of a transitive dependency and peers-of-peers', async () => {
    const depGraph = await parseTransitivePeerDeps();

    const pkgs = depGraph
      .getDepPkgs()
      .map((pkg) => `${pkg.name}@${pkg.version}`);
    expect(pkgs).toEqual(
      expect.arrayContaining([
        'lib-with-peer@1.0.0',
        'minimatch@10.2.2', // peer of lib-with-peer
        'brace-expansion@5.0.6', // peer of minimatch (peer-of-a-peer)
        'balanced-match@4.0.4', // dependency of brace-expansion
      ]),
    );
  });

  // Peers declared on the root package.json get the same handling as peers
  // deeper in the tree - included when installed.
  it('includes a root package peer dependency', async () => {
    const depGraph = await parseTransitivePeerDeps();

    const names = depGraph.getDepPkgs().map((pkg) => pkg.name);
    expect(names).toContain('root-peer');
  });

  // Optional peers (peerDependenciesMeta.optional === true) are not installed
  // by npm v7+, so they must be excluded - at both the root and deeper levels.
  it('excludes optional peer dependencies', async () => {
    const depGraph = await parseTransitivePeerDeps();

    const names = depGraph.getDepPkgs().map((pkg) => pkg.name);
    expect(names).not.toContain('unused-optional-peer'); // optional peer of lib-with-peer
    expect(names).not.toContain('root-optional-absent-peer'); // optional root peer
  });

  // A non-optional peer that is declared but has no lockfile entry (an unmet or
  // conflicting peer) must be skipped, NOT raise OutOfSyncError - even under
  // strictOutOfSync. Earlier attempts that threw here (PRs #233/#239) were
  // reverted for this reason.
  it('skips an unmet non-optional peer without throwing in strict mode', async () => {
    // absent-required-peer is a non-optional peer of lib-with-peer with no
    // corresponding package entry in the lockfile.
    await expect(parseTransitivePeerDeps()).resolves.toBeDefined();

    const depGraph = await parseTransitivePeerDeps();
    const names = depGraph.getDepPkgs().map((pkg) => pkg.name);
    expect(names).not.toContain('absent-required-peer');
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
