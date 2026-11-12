import { matchOverrideKey } from '../../../../lib/dep-graph-builders/npm-lock-v2/index';

describe('npm-lock-v2 matchOverrideKey', () => {
  it('should match name without version spec', async () => {
    const overrides = {
      'pkg-to-override': '1.0.0',
    };
    const pkg = { name: 'pkg-to-override', version: '0.0.1' };

    const override = matchOverrideKey(overrides, pkg);
    expect(override).toBe('1.0.0');
  });
  it('should match name with version spec - range 1', async () => {
    const overrides = {
      'pkg-to-override@^0.0.1': '1.0.0',
    };
    const pkg = { name: 'pkg-to-override', version: '0.0.1' };

    const override = matchOverrideKey(overrides, pkg);
    expect(override).toBe('1.0.0');
  });
  it('should match name with version spec - range 2', async () => {
    const overrides = {
      'pkg-to-override@^0': '1.0.0',
    };
    const pkg = { name: 'pkg-to-override', version: '0.0.1' };

    const override = matchOverrideKey(overrides, pkg);
    expect(override).toBe('1.0.0');
  });
  it('should match name with version spec - exact version', async () => {
    const overrides = {
      'pkg-to-override@0.0.1': '1.0.0',
    };
    const pkg = { name: 'pkg-to-override', version: '0.0.1' };

    const override = matchOverrideKey(overrides, pkg);
    expect(override).toBe('1.0.0');
  });
  it('should match name without version when a version spec exists', async () => {
    const overrides = {
      'pkg-to-override': '4.0.0',
      'pkg-to-override@^0.0.1': '1.0.0',
    };
    const pkg = { name: 'pkg-to-override', version: '0.0.1' };

    const override = matchOverrideKey(overrides, pkg);
    expect(override).toBe('4.0.0');
  });
  it('should not match name if version spec doesnt exist', async () => {
    const overrides = {
      'pkg-to-override@2.0.1': '1.0.0',
    };
    const pkg = { name: 'pkg-to-override', version: '0.0.1' };

    const override = matchOverrideKey(overrides, pkg);
    expect(override).toBe(null);
  });
  it('should match a version range when the requested spec is a range', async () => {
    const overrides = {
      'pkg-to-override@^8': '^9.0.0',
    };
    const pkg = { name: 'pkg-to-override', version: '^8.0.0' };

    const override = matchOverrideKey(overrides, pkg);
    expect(override).toBe('^9.0.0');
  });
  it('should match a match-all version spec when the version is not semver', async () => {
    const overrides = {
      'pkg-to-override@*': '1.0.0',
    };
    const pkg = { name: 'pkg-to-override', version: './lib/pkg-to-override' };

    const override = matchOverrideKey(overrides, pkg);
    expect(override).toBe('1.0.0');
  });
  it('should not match a version range when the version is a local path', async () => {
    const overrides = {
      'pkg-to-override@^1.0.0': '1.0.0',
    };
    const pkg = { name: 'pkg-to-override', version: './lib/pkg-to-override' };

    const override = matchOverrideKey(overrides, pkg);
    expect(override).toBe(null);
  });
  it('should not match a version range when the version is a git url', async () => {
    const overrides = {
      'pkg-to-override@^1.0.0': '1.0.0',
    };
    const pkg = {
      name: 'pkg-to-override',
      version: 'git+https://github.com/org/pkg-to-override.git',
    };

    const override = matchOverrideKey(overrides, pkg);
    expect(override).toBe(null);
  });
});
