import { join } from 'path';
import { readFileSync } from 'fs';
import { parsePnpmProject } from '../../../lib/dep-graph-builders';
import {
  NodeLockfileVersion,
  extractPnpmMainDocument,
  getPnpmLockfileVersion,
} from '../../../lib/utils';

// pnpm 11+ writes pnpm-lock.yaml as a multi-document YAML stream (env/config
// document first, dependency lockfile second) when the project uses
// configDependencies or devEngines.packageManager. Both documents carry
// lockfileVersion 9.0.
describe('pnpm multi-document lockfile (pnpm 11+)', () => {
  const fixtureDir = join(
    __dirname,
    './fixtures/pnpm-lock-v9/multidoc-env-lockfile',
  );
  const pkgJsonContent = readFileSync(join(fixtureDir, 'package.json'), 'utf8');
  const lockfileContent = readFileSync(
    join(fixtureDir, 'pnpm-lock.yaml'),
    'utf8',
  );

  it('parses the dependency document and ignores the env document', async () => {
    const depGraph = await parsePnpmProject(pkgJsonContent, lockfileContent, {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: true,
      pruneWithinTopLevelDeps: false,
    });

    const expectedDepGraphJson = JSON.parse(
      readFileSync(join(fixtureDir, 'expected.json'), 'utf8'),
    );
    expect(JSON.stringify(depGraph)).toBe(JSON.stringify(expectedDepGraphJson));

    // env-document packages (pnpm itself) must not leak into the graph
    const pkgNames = depGraph.getDepPkgs().map((pkg) => pkg.name);
    expect(pkgNames).not.toContain('pnpm');
    expect(pkgNames).not.toContain('@pnpm/exe');
  });

  it('detects the lockfile version from the dependency document', () => {
    expect(getPnpmLockfileVersion(lockfileContent)).toBe(
      NodeLockfileVersion.PnpmLockV9,
    );
  });

  it('detects the lockfile version of an env-only lockfile as v9', () => {
    const envOnly =
      lockfileContent.slice(0, lockfileContent.indexOf('\n---\n')) + '\n---\n';
    expect(getPnpmLockfileVersion(envOnly)).toBe(
      NodeLockfileVersion.PnpmLockV9,
    );
  });

  it('parses a multi-document lockfile with a leading BOM', async () => {
    const depGraph = await parsePnpmProject(
      pkgJsonContent,
      '\ufeff' + lockfileContent,
      {
        includeDevDeps: false,
        includeOptionalDeps: false,
        strictOutOfSync: true,
        pruneWithinTopLevelDeps: false,
      },
    );
    const pkgNames = depGraph.getDepPkgs().map((pkg) => pkg.name);
    expect(pkgNames).toContain('is-odd');
    expect(pkgNames).not.toContain('@pnpm/exe');
  });

  it('treats an env-only lockfile as no lockfile', async () => {
    // pnpm's writer always emits both separators; an env-only file has
    // nothing after the second one
    const envOnly =
      lockfileContent.slice(0, lockfileContent.indexOf('\n---\n')) + '\n---\n';
    const depGraph = await parsePnpmProject(pkgJsonContent, envOnly, {
      includeDevDeps: false,
      includeOptionalDeps: false,
      strictOutOfSync: false,
      pruneWithinTopLevelDeps: false,
    });
    expect(depGraph.getDepPkgs().map((pkg) => pkg.name)).not.toContain('pnpm');
  });

  describe('extractPnpmMainDocument', () => {
    it('returns single-document content unchanged', () => {
      const singleDoc = "lockfileVersion: '9.0'\n\nsettings:\n";
      expect(extractPnpmMainDocument(singleDoc)).toBe(singleDoc);
    });

    it('returns the second document of a multi-document lockfile', () => {
      const extracted = extractPnpmMainDocument(lockfileContent);
      expect(extracted.startsWith("lockfileVersion: '9.0'")).toBe(true);
      expect(extracted).toContain('is-odd');
      expect(extracted).not.toContain('packageManagerDependencies');
    });

    it('handles CRLF line endings', () => {
      const crlfContent = lockfileContent.replace(/\n/g, '\r\n');
      const extracted = extractPnpmMainDocument(crlfContent);
      expect(extracted).toContain('is-odd');
      expect(extracted).not.toContain('packageManagerDependencies');
    });

    it('returns empty string for an env-only lockfile', () => {
      expect(
        extractPnpmMainDocument(
          "---\nlockfileVersion: '9.0'\nimporters: {}\n---\n",
        ),
      ).toBe('');
    });

    it('returns a lone document-start marker unchanged (degenerate input)', () => {
      expect(extractPnpmMainDocument('---\n')).toBe('---\n');
    });
  });
});
