import { join } from 'path';
import { readFileSync } from 'fs';
import { parseNpmLockV2Project } from '../../../lib/dep-graph-builders';
import {
  hashLabelsFromIntegrity,
  distributionUrlLabel,
  getComponentMetadataLabels,
} from '../../../lib/dep-graph-builders/component-metadata-labels';

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
});
