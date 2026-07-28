import { getPnpmWorkspaces } from '../../../lib/parsers';

// js-yaml 4.x returned undefined for a document with no content, so an empty
// pnpm-workspace.yaml fell through to the default glob. js-yaml 5 throws
// instead, which would turn a valid file into an InvalidUserInputError.
// getPnpmWorkspaces catches that specific case by matching on the exception
// reason, so these cases fail loudly if js-yaml rewords the message.
describe('getPnpmWorkspaces with no usable document', () => {
  it.each([
    ['an empty file', ''],
    ['a single newline', '\n'],
    ['only whitespace', '   \n  \t\n'],
    ['only comments', '# packages go here\n'],
  ])('defaults to the root glob for %s', (_label, contents) => {
    expect(getPnpmWorkspaces(contents)).toEqual(['*']);
  });

  it('still reads packages from a populated file', () => {
    expect(getPnpmWorkspaces('packages:\n  - pkgs/*\n  - tools/*\n')).toEqual([
      'pkgs/*',
      'tools/*',
    ]);
  });

  it('defaults to the root glob when packages is absent', () => {
    expect(getPnpmWorkspaces('someOtherKey: true\n')).toEqual(['*']);
  });

  it('still rejects genuinely malformed yaml', () => {
    expect(() => getPnpmWorkspaces('packages:\n  - [unclosed\n')).toThrow(
      /parsing failed/,
    );
  });
});
