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
});
