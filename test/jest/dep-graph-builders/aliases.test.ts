import { join } from 'path';
import { readFileSync } from 'fs';
import {
  buildDepTreeFromFiles,
  parseNpmLockV2Project,
  parsePnpmProject,
  parseYarnLockV1Project,
  parseYarnLockV2Project,
} from '../../../lib/';

describe('Testing aliases for yarn', () => {
  it('match aliased package - yarn-lock-v1', async () => {
    const pkgJsonContent = readFileSync(
      join(__dirname, `./fixtures/aliases/yarn-lock-v1/package.json`),
      'utf8',
    );
    const yarnLockContent = readFileSync(
      join(__dirname, `./fixtures/aliases/yarn-lock-v1/yarn.lock`),
      'utf8',
    );

    const newDepGraph = await parseYarnLockV1Project(
      pkgJsonContent,
      yarnLockContent,
      {
        includeDevDeps: true,
        includeOptionalDeps: true,
        includePeerDeps: false,
        pruneLevel: 'withinTopLevelDeps',
        strictOutOfSync: true,
        honorAliases: true,
      },
    );

    expect(newDepGraph).toBeDefined;
    const pkgs = newDepGraph.getPkgs();
    // expect(JSON.stringify(newDepGraph)).toContain('@yao-pkg/pkg');
    expect(pkgs.some((x) => x.name === 'pkg')).toBeFalsy();
    expect(pkgs.some((x) => x.name === '@yao-pkg/pkg')).toBeTruthy();
  });

  it('match aliased package also used in transitive deps - yarn-lock-v1', async () => {
    const pkgJsonContent = readFileSync(
      join(
        __dirname,
        `./fixtures/aliases/yarn-lock-v1-with-npm-alias-also-on-transitive/package.json`,
      ),
      'utf8',
    );
    const yarnLockContent = readFileSync(
      join(
        __dirname,
        `./fixtures/aliases/yarn-lock-v1-with-npm-alias-also-on-transitive/yarn.lock`,
      ),
      'utf8',
    );

    const newDepGraph = await parseYarnLockV1Project(
      pkgJsonContent,
      yarnLockContent,
      {
        includeDevDeps: true,
        includeOptionalDeps: true,
        includePeerDeps: false,
        pruneLevel: 'withinTopLevelDeps',
        strictOutOfSync: true,
        honorAliases: true,
      },
    );

    expect(newDepGraph).toBeDefined;
    const pkgs = newDepGraph.getPkgs();
    expect(pkgs.some((x) => x.name === 'pkg')).toBeFalsy();
    expect(pkgs.some((x) => x.name === '@yao-pkg/pkg')).toBeTruthy();
  });

  it('ignore aliased package in transitive deps - yarn-lock-v1', async () => {
    const pkgJsonContent = readFileSync(
      join(
        __dirname,
        `./fixtures/aliases/yarn-lock-v1-with-npm-prefixed-sub-dep-version/package.json`,
      ),
      'utf8',
    );
    const yarnLockContent = readFileSync(
      join(
        __dirname,
        `./fixtures/aliases/yarn-lock-v1-with-npm-prefixed-sub-dep-version/yarn.lock`,
      ),
      'utf8',
    );

    const newDepGraph = await parseYarnLockV1Project(
      pkgJsonContent,
      yarnLockContent,
      {
        includeDevDeps: true,
        includeOptionalDeps: true,
        includePeerDeps: false,
        pruneLevel: 'withinTopLevelDeps',
        strictOutOfSync: true,
        honorAliases: true,
      },
    );

    expect(newDepGraph).toBeDefined;
    const pkgs = newDepGraph.getPkgs();
    // expect(JSON.stringify(newDepGraph)).toContain('@yao-pkg/pkg');
    expect(pkgs.some((x) => x.name === 'pkg')).toBeFalsy();
    expect(pkgs.some((x) => x.name === '@yao-pkg/pkg')).toBeTruthy();
  });

  it('match aliased package - yarn-lock-v2', async () => {
    const pkgJsonContent = readFileSync(
      join(__dirname, `./fixtures/aliases/yarn-lock-v2/package.json`),
      'utf8',
    );
    const yarnLockContent = readFileSync(
      join(__dirname, `./fixtures/aliases/yarn-lock-v2/yarn.lock`),
      'utf8',
    );

    const newDepGraph = await parseYarnLockV2Project(
      pkgJsonContent,
      yarnLockContent,
      {
        includeDevDeps: true,
        includeOptionalDeps: true,
        strictOutOfSync: true,
        pruneWithinTopLevelDeps: true,
        honorAliases: true,
      },
    );
    expect(newDepGraph).toBeDefined;
    const pkgs = newDepGraph.getPkgs();
    // expect(JSON.stringify(newDepGraph)).toContain('@yao-pkg/pkg');
    expect(pkgs.some((x) => x.name === 'pkg')).toBeFalsy();
    expect(pkgs.some((x) => x.name === '@yao-pkg/pkg')).toBeTruthy();
  });

  it('match aliased package also used in transitive deps - yarn-lock-v2', async () => {
    const pkgJsonContent = readFileSync(
      join(
        __dirname,
        `./fixtures/aliases/yarn-lock-v2-with-npm-alias-also-on-transitive/package.json`,
      ),
      'utf8',
    );
    const yarnLockContent = readFileSync(
      join(
        __dirname,
        `./fixtures/aliases/yarn-lock-v2-with-npm-alias-also-on-transitive/yarn.lock`,
      ),
      'utf8',
    );

    const newDepGraph = await parseYarnLockV2Project(
      pkgJsonContent,
      yarnLockContent,
      {
        includeDevDeps: true,
        includeOptionalDeps: true,
        strictOutOfSync: true,
        pruneWithinTopLevelDeps: true,
        honorAliases: true,
      },
    );
    expect(newDepGraph).toBeDefined;
    const pkgs = newDepGraph.getPkgs();
    expect(pkgs.some((x) => x.name === 'pkg')).toBeFalsy();
    expect(pkgs.some((x) => x.name === '@yao-pkg/pkg')).toBeTruthy();
  });

  it('ignore aliased package in transitive deps - yarn-lock-v2', async () => {
    const pkgJsonContent = readFileSync(
      join(
        __dirname,
        `./fixtures/aliases/yarn-lock-v2-with-npm-prefixed-sub-dep-version/package.json`,
      ),
      'utf8',
    );
    const yarnLockContent = readFileSync(
      join(
        __dirname,
        `./fixtures/aliases/yarn-lock-v2-with-npm-prefixed-sub-dep-version/yarn.lock`,
      ),
      'utf8',
    );

    const newDepGraph = await parseYarnLockV2Project(
      pkgJsonContent,
      yarnLockContent,
      {
        includeDevDeps: true,
        includeOptionalDeps: true,
        strictOutOfSync: true,
        pruneWithinTopLevelDeps: true,
        honorAliases: true,
      },
    );
    expect(newDepGraph).toBeDefined;
    const pkgs = newDepGraph.getPkgs();
    // expect(JSON.stringify(newDepGraph)).toContain('@yao-pkg/pkg');
    expect(pkgs.some((x) => x.name === 'pkg')).toBeFalsy();
    expect(pkgs.some((x) => x.name === '@yao-pkg/pkg')).toBeTruthy();
  });
});
describe('Testing aliases for npm', () => {
  it('match aliased package - npm-lock-v1', async () => {
    const rootPath = join(__dirname, './fixtures/aliases/npm-lock-v1');

    const newDepGraph = await buildDepTreeFromFiles(
      rootPath,
      join(__dirname, `./fixtures/aliases/npm-lock-v1/package.json`),
      join(__dirname, `./fixtures/aliases/npm-lock-v1/package-lock.json`),
      true,
      true,
      true,
    );

    expect(newDepGraph).toBeDefined;
    expect(() => JSON.parse(JSON.stringify(newDepGraph))).not.toThrow();
    expect(JSON.stringify(newDepGraph)).toContain('@yao-pkg/pkg');
    expect(JSON.stringify(newDepGraph)).not.toContain('"pkg"');
  });
  it('match aliased package also used in transitive deps - npm-lock-v1', async () => {
    const rootPath = join(
      __dirname,
      './fixtures/aliases/npm-lock-v1-with-npm-alias-also-on-transitive',
    );

    const newDepGraph = await buildDepTreeFromFiles(
      rootPath,
      join(
        __dirname,
        `./fixtures/aliases/npm-lock-v1-with-npm-alias-also-on-transitive/package.json`,
      ),
      join(
        __dirname,
        `./fixtures/aliases/npm-lock-v1-with-npm-alias-also-on-transitive/package-lock.json`,
      ),
      true,
      true,
      true,
    );

    expect(newDepGraph).toBeDefined;
    expect(() => JSON.parse(JSON.stringify(newDepGraph))).not.toThrow();
    expect(JSON.stringify(newDepGraph)).toContain('@yao-pkg/pkg');
    expect(JSON.stringify(newDepGraph)).not.toContain('"pkg"');
  });
  it('match aliased package - npm-lock-v2', async () => {
    const pkgJsonContent = readFileSync(
      join(__dirname, `./fixtures/aliases/npm-lock-v2/package.json`),
      'utf8',
    );
    const pkgLockContent = readFileSync(
      join(__dirname, `./fixtures/aliases/npm-lock-v2/package-lock.json`),
      'utf8',
    );

    const newDepGraph = await parseNpmLockV2Project(
      pkgJsonContent,
      pkgLockContent,
      {
        includeDevDeps: true,
        includeOptionalDeps: true,
        pruneCycles: true,
        strictOutOfSync: true,
        honorAliases: true,
      },
    );

    expect(newDepGraph).toBeDefined;
    expect(() => JSON.parse(JSON.stringify(newDepGraph))).not.toThrow();
    expect(JSON.stringify(newDepGraph)).toContain('@yao-pkg/pkg');
    expect(JSON.stringify(newDepGraph)).not.toContain('"pkg"');
  });
  it('match aliased package also used in transitive deps - npm-lock-v2', async () => {
    const pkgJsonContent = readFileSync(
      join(
        __dirname,
        `./fixtures/aliases/npm-lock-v2-with-npm-alias-also-on-transitive/package.json`,
      ),
      'utf8',
    );
    const pkgLockContent = readFileSync(
      join(
        __dirname,
        `./fixtures/aliases/npm-lock-v2-with-npm-alias-also-on-transitive/package-lock.json`,
      ),
      'utf8',
    );

    const newDepGraph = await parseNpmLockV2Project(
      pkgJsonContent,
      pkgLockContent,
      {
        includeDevDeps: true,
        includeOptionalDeps: true,
        pruneCycles: true,
        strictOutOfSync: true,
        honorAliases: true,
      },
    );

    expect(newDepGraph).toBeDefined;
    expect(() => JSON.parse(JSON.stringify(newDepGraph))).not.toThrow();
    expect(JSON.stringify(newDepGraph)).toContain('@yao-pkg/pkg');
    expect(JSON.stringify(newDepGraph)).not.toContain('"pkg"');
  });
  it('match aliased package - npm-lock-v3', async () => {
    const pkgJsonContent = readFileSync(
      join(__dirname, `./fixtures/aliases/npm-lock-v3/package.json`),
      'utf8',
    );
    const pkgLockContent = readFileSync(
      join(__dirname, `./fixtures/aliases/npm-lock-v3/package-lock.json`),
      'utf8',
    );

    const newDepGraph = await parseNpmLockV2Project(
      pkgJsonContent,
      pkgLockContent,
      {
        includeDevDeps: true,
        includeOptionalDeps: true,
        pruneCycles: true,
        strictOutOfSync: true,
        honorAliases: true,
      },
    );

    expect(newDepGraph).toBeDefined;
    expect(() => JSON.parse(JSON.stringify(newDepGraph))).not.toThrow();
    expect(JSON.stringify(newDepGraph)).toContain('@yao-pkg/pkg');
    expect(JSON.stringify(newDepGraph)).not.toContain('"pkg"');
  });
  it('match aliased package also used in transitive deps - npm-lock-v3', async () => {
    const pkgJsonContent = readFileSync(
      join(
        __dirname,
        `./fixtures/aliases/npm-lock-v3-with-npm-alias-also-on-transitive/package.json`,
      ),
      'utf8',
    );
    const pkgLockContent = readFileSync(
      join(
        __dirname,
        `./fixtures/aliases/npm-lock-v3-with-npm-alias-also-on-transitive/package-lock.json`,
      ),
      'utf8',
    );

    const newDepGraph = await parseNpmLockV2Project(
      pkgJsonContent,
      pkgLockContent,
      {
        includeDevDeps: true,
        includeOptionalDeps: true,
        pruneCycles: true,
        strictOutOfSync: true,
        honorAliases: true,
      },
    );

    expect(newDepGraph).toBeDefined;
    expect(() => JSON.parse(JSON.stringify(newDepGraph))).not.toThrow();
    expect(JSON.stringify(newDepGraph)).toContain('@yao-pkg/pkg');
    expect(JSON.stringify(newDepGraph)).not.toContain('"pkg"');
  });
  it('ignore aliased package in transitive deps not throwing out of sync error - npm-lock-v1 testing', async () => {
    const rootPath = join(__dirname, './fixtures/aliases/npm-lock-v1');

    const newDepGraph = await buildDepTreeFromFiles(
      rootPath,
      join(
        __dirname,
        `./fixtures/aliases/npm-lock-v1-with-npm-prefixed-sub-dep-version/package.json`,
      ),
      join(
        __dirname,
        `./fixtures/aliases/npm-lock-v1-with-npm-prefixed-sub-dep-version/package-lock.json`,
      ),
      true,
      true,
      true,
    );

    expect(newDepGraph).toBeDefined;
    expect(() => JSON.parse(JSON.stringify(newDepGraph))).not.toThrow();
    expect(JSON.stringify(newDepGraph)).toContain('@yao-pkg/pkg');
    expect(JSON.stringify(newDepGraph)).not.toContain('"pkg"');
  });
  it('ignore aliased package in transitive deps not throwing out of sync error - npm-lock-v2 testing', async () => {
    const pkgJsonContent = readFileSync(
      join(
        __dirname,
        `./fixtures/aliases/npm-lock-v2-with-npm-prefixed-sub-dep-version/package.json`,
      ),
      'utf8',
    );
    const pkgLockContent = readFileSync(
      join(
        __dirname,
        `./fixtures/aliases/npm-lock-v2-with-npm-prefixed-sub-dep-version/package-lock.json`,
      ),
      'utf8',
    );

    const newDepGraph = await parseNpmLockV2Project(
      pkgJsonContent,
      pkgLockContent,
      {
        includeDevDeps: true,
        includeOptionalDeps: true,
        pruneCycles: true,
        strictOutOfSync: true,
        honorAliases: true,
      },
    );

    expect(newDepGraph).toBeDefined;
    expect(() => JSON.parse(JSON.stringify(newDepGraph))).not.toThrow();
  });
  it('ignore aliased package in transitive deps not throwing out of sync error - npm-lock-v3 testing', async () => {
    const pkgJsonContent = readFileSync(
      join(
        __dirname,
        `./fixtures/aliases/npm-lock-v3-with-npm-prefixed-sub-dep-version/package.json`,
      ),
      'utf8',
    );
    const pkgLockContent = readFileSync(
      join(
        __dirname,
        `./fixtures/aliases/npm-lock-v3-with-npm-prefixed-sub-dep-version/package-lock.json`,
      ),
      'utf8',
    );

    const newDepGraph = await parseNpmLockV2Project(
      pkgJsonContent,
      pkgLockContent,
      {
        includeDevDeps: true,
        includeOptionalDeps: true,
        pruneCycles: true,
        strictOutOfSync: true,
        honorAliases: true,
      },
    );

    expect(newDepGraph).toBeDefined;
    expect(() => JSON.parse(JSON.stringify(newDepGraph))).not.toThrow();
  });
});

describe.each(['pnpm-lock-v5', 'pnpm-lock-v6', 'pnpm-lock-v9'])(
  'Testing aliases for pnpm %s',
  (lockFileVersionPath) => {
    it('match aliased package', async () => {
      const fixtureName = 'pnpm-lock';
      const pkgJsonContent = readFileSync(
        join(
          __dirname,
          `./fixtures/aliases/pnpm/${lockFileVersionPath}/${fixtureName}/package.json`,
        ),
        'utf8',
      );
      const pkgLockContent = readFileSync(
        join(
          __dirname,
          `./fixtures/aliases/pnpm/${lockFileVersionPath}/${fixtureName}/pnpm-lock.yaml`,
        ),
        'utf8',
      );

      const newDepGraph = await parsePnpmProject(
        pkgJsonContent,
        pkgLockContent,
        {
          includeDevDeps: true,
          includePeerDeps: true,
          includeOptionalDeps: true,
          strictOutOfSync: true,
          pruneWithinTopLevelDeps: true,
        },
      );

      expect(newDepGraph).toBeDefined;
      expect(() => JSON.parse(JSON.stringify(newDepGraph))).not.toThrow();
      expect(JSON.stringify(newDepGraph)).toContain('@yao-pkg/pkg');
      expect(JSON.stringify(newDepGraph)).not.toContain('"pkg"');
    });
    it('match aliased package also used in transitive deps', async () => {
      const fixtureName = 'pnpm-lock-with-npm-alias-also-on-transitive';
      const pkgJsonContent = readFileSync(
        join(
          __dirname,
          `./fixtures/aliases/pnpm/${lockFileVersionPath}/${fixtureName}/package.json`,
        ),
        'utf8',
      );
      const pkgLockContent = readFileSync(
        join(
          __dirname,
          `./fixtures/aliases/pnpm/${lockFileVersionPath}/${fixtureName}/pnpm-lock.yaml`,
        ),
        'utf8',
      );

      const newDepGraph = await parsePnpmProject(
        pkgJsonContent,
        pkgLockContent,
        {
          includeDevDeps: true,
          includePeerDeps: true,
          includeOptionalDeps: true,
          strictOutOfSync: true,
          pruneWithinTopLevelDeps: true,
        },
      );

      expect(newDepGraph).toBeDefined;
      expect(() => JSON.parse(JSON.stringify(newDepGraph))).not.toThrow();
      expect(JSON.stringify(newDepGraph)).toContain('@yao-pkg/pkg');
      expect(JSON.stringify(newDepGraph)).not.toContain('"pkg"');
    });

    it('ignore aliased package in transitive deps not throwing out of sync error', async () => {
      const fixtureName = 'pnpm-lock-with-npm-prefixed-sub-dep-version';
      const pkgJsonContent = readFileSync(
        join(
          __dirname,
          `./fixtures/aliases/pnpm/${lockFileVersionPath}/${fixtureName}/package.json`,
        ),
        'utf8',
      );
      const pkgLockContent = readFileSync(
        join(
          __dirname,
          `./fixtures/aliases/pnpm/${lockFileVersionPath}/${fixtureName}/pnpm-lock.yaml`,
        ),
        'utf8',
      );

      const newDepGraph = await parsePnpmProject(
        pkgJsonContent,
        pkgLockContent,
        {
          includeDevDeps: true,
          includePeerDeps: true,
          includeOptionalDeps: true,
          strictOutOfSync: true,
          pruneWithinTopLevelDeps: true,
        },
      );

      expect(newDepGraph).toBeDefined;
      expect(() => JSON.parse(JSON.stringify(newDepGraph))).not.toThrow();
      expect(JSON.stringify(newDepGraph)).toContain('@yao-pkg/pkg');
      expect(JSON.stringify(newDepGraph)).not.toContain('"pkg"');
    });
  },
);
