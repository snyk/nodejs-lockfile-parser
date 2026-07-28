import { getPnpmWorkspaces } from '../../lib';
import { InvalidUserInputError } from '../../lib/errors';

describe('getPnpmWorkspaces', () => {
  it('returns the packages list from a valid pnpm-workspace.yaml', () => {
    const result = getPnpmWorkspaces('packages:\n  - "packages/*"\n');
    expect(result).toEqual(['packages/*']);
  });

  // js-yaml 4 returned null for empty documents and the parser fell through
  // to the default; js-yaml 5 throws instead. These guard the preserved
  // pre-js-yaml-5 behavior.
  it('returns the default for an empty pnpm-workspace.yaml', () => {
    expect(getPnpmWorkspaces('')).toEqual(['*']);
  });

  it('returns the default for a comment-only pnpm-workspace.yaml', () => {
    expect(getPnpmWorkspaces('# no packages here\n')).toEqual(['*']);
  });

  it('returns the default for a whitespace-only pnpm-workspace.yaml', () => {
    expect(getPnpmWorkspaces('   \n')).toEqual(['*']);
  });

  it('returns the default when packages is not an array', () => {
    expect(getPnpmWorkspaces('packages: true\n')).toEqual(['*']);
  });

  it('throws InvalidUserInputError for malformed yaml', () => {
    expect(() => getPnpmWorkspaces('packages:\n"bad')).toThrow(
      InvalidUserInputError,
    );
  });
});
