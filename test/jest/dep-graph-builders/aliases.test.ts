import { join } from 'path';
import { readFileSync } from 'fs';
import {
  parseNpmLockV2Project,
  parseYarnLockV1Project,
  parseYarnLockV2Project,
} from '../../../lib/';

describe('Testing aliases', () => {
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
    console.log(JSON.stringify(newDepGraph));
    expect(newDepGraph).toBeDefined;

    expect(JSON.stringify(newDepGraph)).toContain('@yao-pkg/pkg');
    expect(JSON.stringify(newDepGraph)).not.toContain("'pkg@");
  });

  // it('match aliased package - npm-lock-v2', async () => {
  //   const pkgJsonContent = readFileSync(
  //     join(__dirname, `./fixtures/aliases/package.json`),
  //     'utf8',
  //   );
  //   const pkgLockContent = readFileSync(
  //     join(__dirname, `./fixtures/aliases/package-lock.json`),
  //     'utf8',
  //   );

  //   const newDepGraph = await parseNpmLockV2Project(
  //     pkgJsonContent,
  //     pkgLockContent,
  //     {
  //       includeDevDeps: false,
  //       includeOptionalDeps: true,
  //       pruneCycles: true,
  //       strictOutOfSync: true,
  //     },
  //   );

  //   expect(newDepGraph).toBeDefined;

  //   expect(JSON.stringify(newDepGraph)).toContain('@yao-pkg/pkg');
  //   expect(JSON.stringify(newDepGraph)).not.toContain("'pkg'");
  // });
});
