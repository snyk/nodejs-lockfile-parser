import * as fs from 'fs';
import * as path from 'path';

// We override js-yaml under @yarnpkg/parsers (see "overrides" in package.json)
// to pull the transitive js-yaml 3.15.0 up to 5.x and clear
// SNYK-JS-JSYAML-18313070. js-yaml removed safeLoad in 4.0 and
// @yarnpkg/parsers still calls it, so anything that actually reaches
// @yarnpkg/parsers throws "safeLoad is not a function" at runtime.
//
// That is safe today only because we use @yarnpkg/core purely for structUtils,
// and structUtils does not require @yarnpkg/parsers. Configuration, Manifest,
// Project and LegacyMigrationResolver do. These tests fail if that assumption
// stops holding, so the override cannot break us silently.

const LIB_DIR = path.join(__dirname, '..', '..', 'lib');
const ALLOWED_CORE_MEMBERS = ['structUtils'];

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [full] : [];
  });
}

function relative(file: string): string {
  return path.relative(path.join(__dirname, '..', '..'), file);
}

describe('@yarnpkg/core usage stays limited to structUtils', () => {
  const files = sourceFiles(LIB_DIR).map((file) => ({
    name: relative(file),
    contents: fs.readFileSync(file, 'utf8'),
  }));

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('never imports @yarnpkg/parsers', () => {
    const offenders = files
      .filter(({ contents }) => contents.includes('@yarnpkg/parsers'))
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });

  it('only imports structUtils from @yarnpkg/core', () => {
    const namedImport = /import\s*\{([^}]*)\}\s*from\s*'@yarnpkg\/core'/g;
    const offenders: string[] = [];

    for (const { name, contents } of files) {
      for (const match of contents.matchAll(namedImport)) {
        const members = match[1]
          .split(',')
          .map((member) => member.trim())
          .filter(Boolean);

        for (const member of members) {
          if (!ALLOWED_CORE_MEMBERS.includes(member)) {
            offenders.push(`${name}: ${member}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('only reaches structUtils through namespace imports of @yarnpkg/core', () => {
    const namespaceImport =
      /import\s*\*\s*as\s*(\w+)\s*from\s*'@yarnpkg\/core'/g;
    const offenders: string[] = [];

    for (const { name, contents } of files) {
      for (const match of contents.matchAll(namespaceImport)) {
        const alias = match[1];
        const usage = new RegExp(`\\b${alias}\\.(\\w+)`, 'g');

        for (const use of contents.matchAll(usage)) {
          if (!ALLOWED_CORE_MEMBERS.includes(use[1])) {
            offenders.push(`${name}: ${alias}.${use[1]}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
