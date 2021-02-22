import { test } from 'tap';
import { buildDepGraphFromFiles, buildDepTreeFromFiles } from '../../lib';
import { depTreeToGraph } from '@snyk/dep-graph/dist/legacy';

const fixtures = [
  { name: 'dev-deps-only', npm: true, yarn: true },
  { name: 'empty-dev-deps', npm: true, yarn: true },
  { name: 'external-tarball', npm: true, yarn: true },
  { name: 'git-ssh-url-deps', npm: true, yarn: true },
  { name: 'goof', npm: true, yarn: true },
  { name: 'missing-deps', npm: true, yarn: true },
  { name: 'missing-name', npm: true, yarn: true },
  { name: 'package-json-without-name', npm: true },
  { name: 'package-repeated-in-manifest', npm: true, yarn: true },
  { name: 'simple-test', npm: true },
  { name: 'undefined-deps', npm: true },
  { name: 'file-as-version', npm: true, yarn: true },
  { name: 'invalid-files', error: true },
  { name: 'missing-deps-in-lock', error: true },
  { name: 'out-of-sync', error: true },
  { name: 'out-of-sync-tree', error: true },
];

fixtures.forEach((fixture) => {
  if (fixture.npm) compareLock(fixture, 'package-lock.json', 'npm');
  if (fixture.yarn) compareLock(fixture, 'yarn1/yarn.lock', 'yarn');
  if (fixture.error) {
    comparePackageLockError(fixture, 'package-lock.json', 'npm');
    comparePackageLockError(fixture, 'yarn1/yarn.lock', 'yarn');
  }
});

function compareLock({ name }, lockFilePath, type) {
  test(`${type} - compare dep tree and dep graph results - ${name}`, async (t) => {
    for (const includeDev of [true, false]) {
      const { depGraphFromTree, depGraph } = await generateDepGraphs(
        name,
        lockFilePath,
        includeDev,
        type,
      );

      t.ok(depGraph.equals(depGraphFromTree), `includeDev=${includeDev}`);
    }
  });
}

function comparePackageLockError({ name }, lockFilePath, type) {
  test(`${type} - compare errors dep tree and dep graph results - ${name}`, async (t) => {
    for (const includeDev of [true, false]) {
      const {
        depGraphFromTree: fromTreeError,
        depGraph: depGraphError,
      } = await generateDepGraphs(name, lockFilePath, includeDev, type);

      t.deepEqual(
        [depGraphError.code, depGraphError.name, depGraphError.message],
        [fromTreeError.code, fromTreeError.name, fromTreeError.message],
        `fixture "${name}" error when includeDev=${includeDev}`,
      );
    }
  });
}

async function generateDepGraphs(
  name,
  lockFilePath,
  includeDev: boolean,
  type,
) {
  const root = `${__dirname}/fixtures/${name}/`;
  const manifestFilePath = 'package.json';

  const [depGraphFromTree, depGraph] = await Promise.all([
    buildDepTreeFromFiles(root, manifestFilePath, lockFilePath, includeDev)
      .then((depTree) => depTreeToGraph(depTree, type))
      .catch((err) => err),
    buildDepGraphFromFiles(
      root,
      manifestFilePath,
      lockFilePath,
      includeDev,
    ).catch((err) => err),
  ]);
  return { depGraphFromTree, depGraph };
}
