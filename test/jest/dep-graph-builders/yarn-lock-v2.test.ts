import { createFromJSON } from '@snyk/dep-graph';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseYarnLockV2Project } from '../../../lib/dep-graph-builders/yarn-lock-v2/simple';

describe('dep-graph-builder yarn-lock-v1', () => {
  describe('happy path tests', () => {
    describe('Expected Result tests', () => {
      describe.each([
        'git-remote-url',
        'goof',
        'resolutions-simple',
        'resolutions-scoped',
      ])('[simple tests] project: %s ', (fixtureName) => {
        test('matches expected', async () => {
          const pkgJsonContent = readFileSync(
            join(
              __dirname,
              `./fixtures/yarn-lock-v2/${fixtureName}/package.json`,
            ),
            'utf8',
          );
          const yarnLockContent = readFileSync(
            join(__dirname, `./fixtures/yarn-lock-v2/${fixtureName}/yarn.lock`),
            'utf8',
          );
          const opts = {
            includeDevDeps: false,
            includeOptionalDeps: true,
            pruneCycles: false,
            strictOutOfSync: false,
          };

          const dg = await parseYarnLockV2Project(
            pkgJsonContent,
            yarnLockContent,
            opts,
          );

          const expectedDepGraphJson = JSON.parse(
            readFileSync(
              join(
                __dirname,
                `./fixtures/yarn-lock-v2/${fixtureName}/expected.json`,
              ),
              'utf8',
            ),
          );

          expect(dg).toBeTruthy();

          const expectedDepGraph = createFromJSON(expectedDepGraphJson);
          expect(dg.equals(expectedDepGraph)).toBeTruthy();
        });
      });
    });
  });
});
