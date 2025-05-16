import { join } from 'path';
import { readFileSync } from 'fs';
import {
  buildDepTreeFromFiles,
  parseNpmLockV2Project,
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

    expect(JSON.stringify(newDepGraph)).toContain('@yao-pkg/pkg');
    expect(JSON.stringify(newDepGraph)).not.toContain("'pkg'");
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

    expect(JSON.stringify(newDepGraph)).toContain('@yao-pkg/pkg');
    expect(JSON.stringify(newDepGraph)).not.toContain("'pkg@");
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
});
