import { join } from 'path';
import { readFileSync } from 'fs';
import {
  parseNpmLockV2Project,
  parseYarnLockV1Project,
  parseYarnLockV2Project,
} from '../../../lib/dep-graph-builders';
import {
  hashLabelsFromIntegrity,
  distributionUrlLabel,
  hashLabelFromResolvedFragment,
  getComponentMetadataLabels,
} from '../../../lib/component-metadata-labels';

describe('hashLabelsFromIntegrity', () => {
  it('converts an sha512 SRI value to a lowercase-hex hash:sha-512 label', () => {
    const integrity =
      'sha512-Il80Qs2WjYlJIBNzNkK6KYqlVMTbZLXgHx2oT0pU/fjRHyEp+PEfEPY0R3WCwAGVOtauxh1hOxNgIf5bv7dQpA==';

    expect(hashLabelsFromIntegrity(integrity, 'accepts@1.3.7')).toEqual({
      'hash:sha-512':
        '225f3442cd968d89492013733642ba298aa554c4db64b5e01f1da84f4a54fdf8d11f2129f8f11f10f634477582c001953ad6aec61d613b136021fe5bbfb750a4',
    });
  });

  it('maps each SRI algorithm to its hyphenated label key', () => {
    const sha1 = `sha1-${Buffer.from('a'.repeat(20)).toString('base64')}`;
    const md5 = `md5-${Buffer.from('b'.repeat(16)).toString('base64')}`;
    expect(hashLabelsFromIntegrity(sha1, 'x@1')).toEqual({
      'hash:sha-1': Buffer.from('a'.repeat(20)).toString('hex'),
    });
    expect(hashLabelsFromIntegrity(md5, 'x@1')).toEqual({
      'hash:md5': Buffer.from('b'.repeat(16)).toString('hex'),
    });
  });

  it('handles multiple whitespace-separated hashes in one SRI string', () => {
    const sha256 = `sha256-${Buffer.from('c'.repeat(32)).toString('base64')}`;
    const sha512 = `sha512-${Buffer.from('d'.repeat(64)).toString('base64')}`;
    expect(hashLabelsFromIntegrity(`${sha256} ${sha512}`, 'x@1')).toEqual({
      'hash:sha-256': Buffer.from('c'.repeat(32)).toString('hex'),
      'hash:sha-512': Buffer.from('d'.repeat(64)).toString('hex'),
    });
  });

  it('strips SRI ?options from the base64 segment', () => {
    const value = `sha512-${Buffer.from('e'.repeat(64)).toString(
      'base64',
    )}?foo=bar`;
    expect(hashLabelsFromIntegrity(value, 'x@1')).toEqual({
      'hash:sha-512': Buffer.from('e'.repeat(64)).toString('hex'),
    });
  });

  it('returns {} for missing or unrecognised integrity (no throw)', () => {
    expect(hashLabelsFromIntegrity(undefined, 'x@1')).toEqual({});
    expect(hashLabelsFromIntegrity('', 'x@1')).toEqual({});
    expect(hashLabelsFromIntegrity('not-a-real-sri', 'x@1')).toEqual({});
    expect(hashLabelsFromIntegrity('nodash', 'x@1')).toEqual({});
  });

  it('skips a hash whose decoded length does not match the algorithm', () => {
    // sha512 expects 64 bytes; a 10-byte digest is malformed and must be rejected.
    const tooShort = `sha512-${Buffer.from('x'.repeat(10)).toString('base64')}`;
    expect(hashLabelsFromIntegrity(tooShort, 'x@1')).toEqual({});
  });

  it('matches uppercase algorithm tokens', () => {
    const value = `SHA512-${Buffer.from('d'.repeat(64)).toString('base64')}`;
    expect(hashLabelsFromIntegrity(value, 'x@1')).toEqual({
      'hash:sha-512': Buffer.from('d'.repeat(64)).toString('hex'),
    });
  });
});

describe('distributionUrlLabel', () => {
  it('emits distribution:url for http(s) resolved URLs', () => {
    const url = 'https://registry.npmjs.org/accepts/-/accepts-1.3.7.tgz';
    expect(distributionUrlLabel(url, 'accepts@1.3.7')).toEqual({
      'distribution:url': url,
    });
  });

  it('returns {} for missing or non-http resolved values (no throw)', () => {
    expect(distributionUrlLabel(undefined, 'x@1')).toEqual({});
    expect(distributionUrlLabel('file:../local-pkg', 'x@1')).toEqual({});
    expect(distributionUrlLabel('', 'x@1')).toEqual({});
  });

  it('accepts uppercase/mixed-case http(s) schemes (normalised to lowercase)', () => {
    expect(
      distributionUrlLabel(
        'HTTPS://registry.internal/pkg/-/pkg-1.0.0.tgz',
        'pkg@1.0.0',
      ),
    ).toEqual({
      'distribution:url': 'https://registry.internal/pkg/-/pkg-1.0.0.tgz',
    });
  });

  it('strips embedded basic-auth credentials from the resolved URL', () => {
    expect(
      distributionUrlLabel(
        'https://user:token@registry.internal/pkg/-/pkg-1.0.0.tgz',
        'pkg@1.0.0',
      ),
    ).toEqual({
      'distribution:url': 'https://registry.internal/pkg/-/pkg-1.0.0.tgz',
    });
    // userless token form (e.g. _authToken in URL) is also stripped
    expect(
      distributionUrlLabel(
        'https://sometoken@registry.internal/pkg/-/pkg-1.0.0.tgz',
        'pkg@1.0.0',
      ),
    ).toEqual({
      'distribution:url': 'https://registry.internal/pkg/-/pkg-1.0.0.tgz',
    });
  });

  it('leaves a literal @ in a path segment untouched', () => {
    const url = 'https://registry.npmjs.org/@scope/pkg/-/pkg-1.0.0.tgz';
    expect(distributionUrlLabel(url, '@scope/pkg@1.0.0')).toEqual({
      'distribution:url': url,
    });
  });

  it('strips the yarn v1 shasum fragment from the emitted URL', () => {
    expect(
      distributionUrlLabel(
        'https://registry.yarnpkg.com/pkg/-/pkg-1.0.0.tgz#80aec64c9d6d97e65cc2a9caa93c0aa6abf73aaa',
        'pkg@1.0.0',
      ),
    ).toEqual({
      'distribution:url': 'https://registry.yarnpkg.com/pkg/-/pkg-1.0.0.tgz',
    });
  });
});

describe('hashLabelFromResolvedFragment', () => {
  it('emits hash:sha-1 from a 40-hex fragment on an http(s) tarball URL', () => {
    expect(
      hashLabelFromResolvedFragment(
        'https://registry.yarnpkg.com/pkg/-/pkg-1.0.0.tgz#80aec64c9d6d97e65cc2a9caa93c0aa6abf73aaa',
        'pkg@1.0.0',
      ),
    ).toEqual({ 'hash:sha-1': '80aec64c9d6d97e65cc2a9caa93c0aa6abf73aaa' });
  });

  it('lowercases the fragment', () => {
    expect(
      hashLabelFromResolvedFragment(
        'https://registry.yarnpkg.com/pkg/-/pkg-1.0.0.tgz#80AEC64C9D6D97E65CC2A9CAA93C0AA6ABF73AAA',
        'pkg@1.0.0',
      ),
    ).toEqual({ 'hash:sha-1': '80aec64c9d6d97e65cc2a9caa93c0aa6abf73aaa' });
  });

  it('does NOT mine a fragment from git resolutions (it is a commit SHA, not a shasum)', () => {
    expect(
      hashLabelFromResolvedFragment(
        'git+ssh://git@github.com/foo/bar.git#263f602e6ae34add6332c1eb4caa808893b0b711',
        'git-dep@2.0.0',
      ),
    ).toEqual({});
  });

  it('returns {} for missing, non-http, or non-sha1 fragments (no throw)', () => {
    expect(hashLabelFromResolvedFragment(undefined, 'x@1')).toEqual({});
    expect(
      hashLabelFromResolvedFragment(
        'https://registry.yarnpkg.com/pkg/-/pkg-1.0.0.tgz',
        'x@1',
      ),
    ).toEqual({});
    expect(
      hashLabelFromResolvedFragment(
        'https://registry.yarnpkg.com/pkg/-/pkg-1.0.0.tgz#notahash',
        'x@1',
      ),
    ).toEqual({});
    expect(hashLabelFromResolvedFragment('file:../local#abc', 'x@1')).toEqual(
      {},
    );
  });
});

describe('getComponentMetadataLabels', () => {
  it('merges hash and distribution:url labels', () => {
    const labels = getComponentMetadataLabels({
      id: 'accepts@1.3.7',
      integrity:
        'sha512-Il80Qs2WjYlJIBNzNkK6KYqlVMTbZLXgHx2oT0pU/fjRHyEp+PEfEPY0R3WCwAGVOtauxh1hOxNgIf5bv7dQpA==',
      resolved: 'https://registry.npmjs.org/accepts/-/accepts-1.3.7.tgz',
    });
    expect(labels).toEqual({
      'hash:sha-512':
        '225f3442cd968d89492013733642ba298aa554c4db64b5e01f1da84f4a54fdf8d11f2129f8f11f10f634477582c001953ad6aec61d613b136021fe5bbfb750a4',
      'distribution:url':
        'https://registry.npmjs.org/accepts/-/accepts-1.3.7.tgz',
    });
  });

  it('returns {} when no metadata is available', () => {
    expect(getComponentMetadataLabels({ id: 'x@1' })).toEqual({});
  });

  it('derives hash:sha-1 from the resolved fragment when there is no integrity (yarn v1)', () => {
    expect(
      getComponentMetadataLabels({
        id: 'pkg@1.0.0',
        resolved:
          'https://registry.yarnpkg.com/pkg/-/pkg-1.0.0.tgz#80aec64c9d6d97e65cc2a9caa93c0aa6abf73aaa',
      }),
    ).toEqual({
      'distribution:url': 'https://registry.yarnpkg.com/pkg/-/pkg-1.0.0.tgz',
      'hash:sha-1': '80aec64c9d6d97e65cc2a9caa93c0aa6abf73aaa',
    });
  });

  it('lets an explicit integrity sha1 win over the resolved-fragment sha1', () => {
    const integrity = `sha1-${Buffer.from('a'.repeat(20)).toString('base64')}`;
    const labels = getComponentMetadataLabels({
      id: 'pkg@1.0.0',
      integrity,
      resolved:
        'https://registry.yarnpkg.com/pkg/-/pkg-1.0.0.tgz#80aec64c9d6d97e65cc2a9caa93c0aa6abf73aaa',
    });
    expect(labels['hash:sha-1']).toBe(
      Buffer.from('a'.repeat(20)).toString('hex'),
    );
  });
});

describe('npm lockfile v2 component-metadata labels (end-to-end)', () => {
  const fixtureDir = join(__dirname, './fixtures/npm-lock-v2/one-dep');
  const pkgJsonContent = readFileSync(join(fixtureDir, 'package.json'), 'utf8');
  const pkgLockContent = readFileSync(
    join(fixtureDir, 'package-lock.json'),
    'utf8',
  );

  const baseOptions = {
    includeDevDeps: false,
    includeOptionalDeps: true,
    pruneCycles: true,
    strictOutOfSync: true,
    honorAliases: true,
  };

  it('GIVEN includeComponentMetadata true THEN dependency nodes carry hash:* and distribution:url labels', async () => {
    const depGraph = await parseNpmLockV2Project(
      pkgJsonContent,
      pkgLockContent,
      {
        ...baseOptions,
        includeComponentMetadata: true,
      },
    );

    const nodes = depGraph.toJSON().graph.nodes;
    const acceptsNode = nodes.find((node) => node.nodeId === 'accepts@1.3.7');
    expect(acceptsNode).toBeDefined();
    expect(acceptsNode?.info?.labels?.['hash:sha-512']).toBe(
      '225f3442cd968d89492013733642ba298aa554c4db64b5e01f1da84f4a54fdf8d11f2129f8f11f10f634477582c001953ad6aec61d613b136021fe5bbfb750a4',
    );
    expect(acceptsNode?.info?.labels?.['distribution:url']).toBe(
      'https://registry.npmjs.org/accepts/-/accepts-1.3.7.tgz',
    );

    // Every (non-root) node in this fixture has integrity + a registry URL.
    const dependencyNodes = nodes.filter((node) => node.nodeId !== 'root-node');
    expect(dependencyNodes.length).toBeGreaterThan(0);
    dependencyNodes.forEach((node) => {
      expect(node.info?.labels?.['hash:sha-512']).toMatch(/^[0-9a-f]{128}$/);
      expect(node.info?.labels?.['distribution:url']).toMatch(/^https:\/\//);
    });
  });

  it('GIVEN includeComponentMetadata false THEN no hash:* or distribution:url labels appear', async () => {
    const depGraph = await parseNpmLockV2Project(
      pkgJsonContent,
      pkgLockContent,
      {
        ...baseOptions,
        includeComponentMetadata: false,
      },
    );

    const nodes = depGraph.toJSON().graph.nodes;
    nodes.forEach((node) => {
      expect(node.info?.labels?.['hash:sha-512']).toBeUndefined();
      expect(node.info?.labels?.['distribution:url']).toBeUndefined();
    });
  });

  it('GIVEN a package with no integrity / non-http resolved THEN it carries neither label, while a registry dep carries both', async () => {
    const dir = join(__dirname, './fixtures/npm-lock-v2/missing-integrity');
    const depGraph = await parseNpmLockV2Project(
      readFileSync(join(dir, 'package.json'), 'utf8'),
      readFileSync(join(dir, 'package-lock.json'), 'utf8'),
      { ...baseOptions, includeComponentMetadata: true },
    );

    const nodes = depGraph.toJSON().graph.nodes;

    // Registry dependency: has integrity + an https registry URL -> both labels.
    const acceptsNode = nodes.find((node) => node.nodeId === 'accepts@1.3.7');
    expect(acceptsNode?.info?.labels?.['hash:sha-512']).toMatch(
      /^[0-9a-f]{128}$/,
    );
    expect(acceptsNode?.info?.labels?.['distribution:url']).toMatch(
      /^https:\/\//,
    );

    // Git dependency: no integrity and a git+ssh resolved -> neither label.
    const gitNode = nodes.find((node) => node.nodeId === 'git-dep@2.0.0');
    expect(gitNode).toBeDefined();
    expect(gitNode?.info?.labels?.['hash:sha-512']).toBeUndefined();
    expect(gitNode?.info?.labels?.['distribution:url']).toBeUndefined();
  });
});

describe('npm lockfile v1 component-metadata labels (legacy depTree)', () => {
  const dir = join(__dirname, './fixtures/npm-lock-v1/mixed-hashes');
  const pkgJson = readFileSync(join(dir, 'package.json'), 'utf8');
  const lock = readFileSync(join(dir, 'package-lock.json'), 'utf8');

  it('GIVEN includeComponentMetadata true THEN v1 depTree nodes carry hash:* (sha-1 + sha-512) and distribution:url', async () => {
    const { buildDepTree, LockfileType } = await import('../../../lib');
    const depTree = await buildDepTree(
      pkgJson,
      lock,
      false, // includeDev
      LockfileType.npm,
      true, // strictOutOfSync
      'package.json',
      false, // showNpmScope
      true, // includeComponentMetadata
    );

    const accepts = depTree.dependencies?.['accepts'];
    expect(accepts?.labels?.['hash:sha-512']).toBe(
      Buffer.from(
        'Il80Qs2WjYlJIBNzNkK6KYqlVMTbZLXgHx2oT0pU/fjRHyEp+PEfEPY0R3WCwAGVOtauxh1hOxNgIf5bv7dQpA==',
        'base64',
      ).toString('hex'),
    );
    expect(accepts?.labels?.['distribution:url']).toBe(
      'https://registry.npmjs.org/accepts/-/accepts-1.3.7.tgz',
    );

    // sha1 integrity (common in v1 lockfiles) maps to hash:sha-1.
    const ansiRegex = depTree.dependencies?.['ansi-regex'];
    expect(ansiRegex?.labels?.['hash:sha-1']).toBe(
      Buffer.from('w7M6te42DYbg5ijwRorn7yfWVN8=', 'base64').toString('hex'),
    );
    expect(ansiRegex?.labels?.['distribution:url']).toBe(
      'https://registry.npmjs.org/ansi-regex/-/ansi-regex-2.1.1.tgz',
    );
  });

  it('GIVEN includeComponentMetadata false THEN no hash:* / distribution:url labels on v1 depTree nodes', async () => {
    const { buildDepTree, LockfileType } = await import('../../../lib');
    const depTree = await buildDepTree(
      pkgJson,
      lock,
      false,
      LockfileType.npm,
      true,
      'package.json',
      false,
      false,
    );
    const accepts = depTree.dependencies?.['accepts'];
    expect(accepts?.labels?.['hash:sha-512']).toBeUndefined();
    expect(accepts?.labels?.['distribution:url']).toBeUndefined();
  });
});

describe('yarn lockfile v1 component-metadata labels (modern dep-graph)', () => {
  const dir = join(__dirname, './fixtures/yarn-lock-v1/component-metadata');
  const pkgJson = readFileSync(join(dir, 'package.json'), 'utf8');
  const lock = readFileSync(join(dir, 'yarn.lock'), 'utf8');

  const baseOptions = {
    includeDevDeps: false,
    includeOptionalDeps: true,
    includePeerDeps: false,
    pruneLevel: 'withinTopLevelDeps' as const,
    strictOutOfSync: false,
    honorAliases: true,
  };

  it('GIVEN includeComponentMetadata true THEN v1 nodes carry hash:* and distribution:url labels from integrity/resolved', async () => {
    const depGraph = await parseYarnLockV1Project(pkgJson, lock, {
      ...baseOptions,
      includeComponentMetadata: true,
    });
    const nodes = depGraph.toJSON().graph.nodes;
    const labelsFor = (id: string) =>
      nodes.find((n) => n.nodeId === id)?.info?.labels || {};

    // sha512 integrity -> hash:sha-512; resolved URL fragment stripped.
    expect(labelsFor('pkg-sha512@1.0.0')['hash:sha-512']).toBe(
      Buffer.from(
        'Il80Qs2WjYlJIBNzNkK6KYqlVMTbZLXgHx2oT0pU/fjRHyEp+PEfEPY0R3WCwAGVOtauxh1hOxNgIf5bv7dQpA==',
        'base64',
      ).toString('hex'),
    );
    expect(labelsFor('pkg-sha512@1.0.0')['distribution:url']).toBe(
      'https://registry.yarnpkg.com/pkg-sha512/-/pkg-sha512-1.0.0.tgz',
    );

    // sha1 integrity -> hash:sha-1.
    expect(labelsFor('pkg-sha1@1.0.0')['hash:sha-1']).toBe(
      Buffer.from('w7M6te42DYbg5ijwRorn7yfWVN8=', 'base64').toString('hex'),
    );

    // No integrity line, but the resolved URL fragment carries the shasum -> hash:sha-1.
    expect(labelsFor('pkg-fragment-only@1.0.0')['hash:sha-1']).toBe(
      '80aec64c9d6d97e65cc2a9caa93c0aa6abf73aaa',
    );
    expect(labelsFor('pkg-fragment-only@1.0.0')['distribution:url']).toBe(
      'https://registry.yarnpkg.com/pkg-fragment-only/-/pkg-fragment-only-1.0.0.tgz',
    );

    // git dependency: fragment is a commit SHA, not a package hash -> no hash / no url.
    expect(labelsFor('git-dep@2.0.0')['hash:sha-1']).toBeUndefined();
    expect(labelsFor('git-dep@2.0.0')['distribution:url']).toBeUndefined();
  });

  it('GIVEN includeComponentMetadata false THEN no hash:* / distribution:url labels appear', async () => {
    const depGraph = await parseYarnLockV1Project(pkgJson, lock, {
      ...baseOptions,
      includeComponentMetadata: false,
    });
    depGraph.toJSON().graph.nodes.forEach((node) => {
      expect(node.info?.labels?.['hash:sha-512']).toBeUndefined();
      expect(node.info?.labels?.['hash:sha-1']).toBeUndefined();
      expect(node.info?.labels?.['distribution:url']).toBeUndefined();
    });
  });
});

describe('yarn lockfile v1 component-metadata labels (legacy depTree)', () => {
  const dir = join(__dirname, './fixtures/yarn-lock-v1/component-metadata');
  const pkgJson = readFileSync(join(dir, 'package.json'), 'utf8');
  const lock = readFileSync(join(dir, 'yarn.lock'), 'utf8');

  it('GIVEN includeComponentMetadata true THEN v1 depTree nodes carry hash:* / distribution:url', async () => {
    const { buildDepTree, LockfileType } = await import('../../../lib');
    const depTree = await buildDepTree(
      pkgJson,
      lock,
      false, // includeDev
      LockfileType.yarn,
      false, // strictOutOfSync
      'package.json',
      false, // showNpmScope
      true, // includeComponentMetadata
    );

    const sha512 = depTree.dependencies?.['pkg-sha512'];
    expect(sha512?.labels?.['hash:sha-512']).toBe(
      Buffer.from(
        'Il80Qs2WjYlJIBNzNkK6KYqlVMTbZLXgHx2oT0pU/fjRHyEp+PEfEPY0R3WCwAGVOtauxh1hOxNgIf5bv7dQpA==',
        'base64',
      ).toString('hex'),
    );
    expect(sha512?.labels?.['distribution:url']).toBe(
      'https://registry.yarnpkg.com/pkg-sha512/-/pkg-sha512-1.0.0.tgz',
    );

    const fragmentOnly = depTree.dependencies?.['pkg-fragment-only'];
    expect(fragmentOnly?.labels?.['hash:sha-1']).toBe(
      '80aec64c9d6d97e65cc2a9caa93c0aa6abf73aaa',
    );
  });

  it('GIVEN includeComponentMetadata false THEN no hash:* / distribution:url labels', async () => {
    const { buildDepTree, LockfileType } = await import('../../../lib');
    const depTree = await buildDepTree(
      pkgJson,
      lock,
      false,
      LockfileType.yarn,
      false,
      'package.json',
      false,
      false,
    );
    const sha512 = depTree.dependencies?.['pkg-sha512'];
    expect(sha512?.labels?.['hash:sha-512']).toBeUndefined();
    expect(sha512?.labels?.['distribution:url']).toBeUndefined();
  });
});

describe('yarn berry component-metadata labels (deferred - no-op)', () => {
  const dir = join(
    __dirname,
    './fixtures/yarn-lock-v2/hand-rolled/simple-chain',
  );
  const pkgJson = readFileSync(join(dir, 'package.json'), 'utf8');
  const lock = readFileSync(join(dir, 'yarn.lock'), 'utf8');

  it('GIVEN includeComponentMetadata true THEN berry emits no hash:* / distribution:url labels (deferred)', async () => {
    const depGraph = await parseYarnLockV2Project(pkgJson, lock, {
      includeDevDeps: false,
      includeOptionalDeps: true,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: true,
      includeComponentMetadata: true,
    });
    depGraph.toJSON().graph.nodes.forEach((node) => {
      expect(node.info?.labels?.['hash:sha-512']).toBeUndefined();
      expect(node.info?.labels?.['hash:sha-1']).toBeUndefined();
      expect(node.info?.labels?.['distribution:url']).toBeUndefined();
    });
  });
});
