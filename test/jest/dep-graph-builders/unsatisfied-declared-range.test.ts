import { readFileSync } from 'fs';
import { join } from 'path';
import type { DepGraph } from '@snyk/dep-graph';
import { parseNpmLockV2Project } from '../../../lib/dep-graph-builders';
import { getUnsatisfiedDeclaredRange } from '../../../lib/dep-graph-builders/util';

const fixture = (...parts: string[]) =>
  readFileSync(join(__dirname, 'fixtures', ...parts), 'utf8');

const labelsFor = (dg: DepGraph, pkgId: string) =>
  dg.toJSON().graph.nodes.find((n) => n.pkgId === pkgId)?.info?.labels;

describe('getUnsatisfiedDeclaredRange', () => {
  it('returns the declared range when the locked version does not satisfy it', () => {
    expect(getUnsatisfiedDeclaredRange('^4.17.21', '4.17.17')).toBe('^4.17.21');
    expect(getUnsatisfiedDeclaredRange('4.17.21', '4.17.17')).toBe('4.17.21');
  });

  it('returns undefined when the locked version satisfies the range', () => {
    expect(getUnsatisfiedDeclaredRange('^4.17.0', '4.17.17')).toBeUndefined();
    expect(getUnsatisfiedDeclaredRange('4.17.17', '4.17.17')).toBeUndefined();
  });

  it.each([
    ['', '1.0.0'],
    ['*', '1.0.0'],
    ['x', '1.0.0'],
    ['X', '1.0.0'],
    ['latest', '1.0.0'],
    ['file:../local', '1.0.0'],
    ['link:../local', '1.0.0'],
    ['workspace:*', '1.0.0'],
    ['npm:other@1.0.0', '1.0.0'],
    ['git+https://github.com/a/b.git', '1.0.0'],
    ['github:a/b', '1.0.0'],
    ['https://example.com/pkg.tgz', '1.0.0'],
    ['user/repo', '1.0.0'],
    ['user/repo#main', '1.0.0'],
    ['not a range', '1.0.0'],
  ])(
    'skips non-comparable or wildcard declared range %j',
    (declared, locked) => {
      expect(getUnsatisfiedDeclaredRange(declared, locked)).toBeUndefined();
    },
  );

  it('does not false-positive on prerelease locked versions when includePrerelease would satisfy', () => {
    expect(
      getUnsatisfiedDeclaredRange('^1.0.0', '1.2.3-beta.1'),
    ).toBeUndefined();
  });

  it('still labels a prerelease that remains outside the range', () => {
    expect(getUnsatisfiedDeclaredRange('^2.0.0', '1.2.3-beta.1')).toBe(
      '^2.0.0',
    );
  });

  it('skips when the locked version is not valid semver', () => {
    expect(getUnsatisfiedDeclaredRange('^1.0.0', '')).toBeUndefined();
    expect(
      getUnsatisfiedDeclaredRange('^1.0.0', 'not-a-version'),
    ).toBeUndefined();
  });
});

describe('npm lockfile v2/v3 unsatisfiedDeclaredRange label', () => {
  const parse = (
    pkgJsonContent: string,
    npmLockContent: string,
    extras: Partial<{
      includeDevDeps: boolean;
      strictOutOfSync: boolean;
      showNpmScope: boolean;
    }> = {},
  ) =>
    parseNpmLockV2Project(pkgJsonContent, npmLockContent, {
      includeDevDeps: extras.includeDevDeps ?? false,
      includeOptionalDeps: true,
      pruneCycles: true,
      strictOutOfSync: extras.strictOutOfSync ?? false,
      showNpmScope: extras.showNpmScope,
    });

  it('labels a top-level dep whose locked version violates the declared range', async () => {
    const dg = await parse(
      fixture('npm-lock-v2', 'simple-out-of-sync', 'package.json'),
      fixture('npm-lock-v2', 'simple-out-of-sync', 'package-lock.json'),
    );

    expect(labelsFor(dg, 'lodash@4.17.17')).toMatchObject({
      scope: 'prod',
      unsatisfiedDeclaredRange: '4.17.21',
    });
  });

  it('does not label when the locked version satisfies the declared range', async () => {
    const pkgJson = JSON.parse(
      fixture('npm-lock-v2', 'simple-out-of-sync', 'package.json'),
    );
    pkgJson.dependencies.lodash = '^4.17.0';
    const dg = await parse(
      JSON.stringify(pkgJson),
      fixture('npm-lock-v2', 'simple-out-of-sync', 'package-lock.json'),
    );

    expect(
      labelsFor(dg, 'lodash@4.17.17')?.unsatisfiedDeclaredRange,
    ).toBeUndefined();
  });

  it('does not label a transitive-only mismatch', async () => {
    const dg = await parse(
      fixture(
        'npm-lock-v2',
        'unsatisfied-declared-range',
        'transitive-only',
        'package.json',
      ),
      fixture(
        'npm-lock-v2',
        'unsatisfied-declared-range',
        'transitive-only',
        'package-lock.json',
      ),
    );

    expect(labelsFor(dg, 'ms@0.6.2')?.unsatisfiedDeclaredRange).toBeUndefined();
    expect(
      labelsFor(dg, 'debug@2.6.9')?.unsatisfiedDeclaredRange,
    ).toBeUndefined();
  });

  it('skips file:, npm: alias, wildcard and dist-tag declared specs', async () => {
    const dg = await parse(
      fixture(
        'npm-lock-v2',
        'unsatisfied-declared-range',
        'skipped-specs',
        'package.json',
      ),
      fixture(
        'npm-lock-v2',
        'unsatisfied-declared-range',
        'skipped-specs',
        'package-lock.json',
      ),
    );

    const labelled = dg
      .toJSON()
      .graph.nodes.filter((n) => n.info?.labels?.unsatisfiedDeclaredRange);
    expect(labelled).toEqual([]);
  });

  it('skips overridden top-level dependencies', async () => {
    const dg = await parse(
      fixture(
        'npm-lock-v2',
        'unsatisfied-declared-range',
        'with-override',
        'package.json',
      ),
      fixture(
        'npm-lock-v2',
        'unsatisfied-declared-range',
        'with-override',
        'package-lock.json',
      ),
    );

    expect(
      labelsFor(dg, 'lodash@4.17.17')?.unsatisfiedDeclaredRange,
    ).toBeUndefined();
  });

  it('re-adds a top-level dep first reached transitively without changing scope', async () => {
    const dg = await parse(
      fixture(
        'npm-lock-v2',
        'unsatisfied-declared-range',
        'transitive-first',
        'package.json',
      ),
      fixture(
        'npm-lock-v2',
        'unsatisfied-declared-range',
        'transitive-first',
        'package-lock.json',
      ),
      { includeDevDeps: true, showNpmScope: true },
    );

    const labels = labelsFor(dg, 'lodash@4.17.17');
    // First reached via prod parent; re-add must keep prod scope while adding the label.
    expect(labels).toMatchObject({
      scope: 'prod',
      'npm:scope': 'prod',
      unsatisfiedDeclaredRange: '^4.17.21',
    });
  });

  it('does not change graph structure for a labelled out-of-sync top-level dep', async () => {
    const dg = await parse(
      fixture('npm-lock-v2', 'simple-out-of-sync', 'package.json'),
      fixture('npm-lock-v2', 'simple-out-of-sync', 'package-lock.json'),
    );
    const json = dg.toJSON();

    expect(json.pkgs.map((p) => p.id).sort()).toEqual([
      'lodash@4.17.17',
      'simple-out-of-sync@1.0.0',
    ]);
    expect(
      json.graph.nodes.find((n) => n.nodeId === 'root-node')?.deps,
    ).toEqual([{ nodeId: 'lodash@4.17.17' }]);
  });
});
