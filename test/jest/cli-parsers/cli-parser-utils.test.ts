import {
  extractCorrectIdentifierBySemver,
  extractNameAndIdentifier,
} from '../../../lib/cli-parsers/cli-parser-utils';

describe('Cli Parser Utils', () => {
  describe('extractNameAndIdentifier', () => {
    it('should correctly return components of a standard pkg string', () => {
      const { name, identifier } = extractNameAndIdentifier('pkg@0.0.1');
      expect(name).toBe('pkg');
      expect(identifier).toBe('0.0.1');
    });
    it('should correctly return components of a scoped pkg string', () => {
      const { name, identifier } =
        extractNameAndIdentifier('@scoped/pkg@0.0.1');
      expect(name).toBe('@scoped/pkg');
      expect(identifier).toBe('0.0.1');
    });
    it('should correctly return components of a pkg with a semver version', () => {
      const { name, identifier } =
        extractNameAndIdentifier('@scoped/pkg@^0.0.1');
      expect(name).toBe('@scoped/pkg');
      expect(identifier).toBe('^0.0.1');
    });
  });
  describe('extractCorrectIdentifierBySemver', () => {
    it('should correctly return standard pkg string if no semver qualifiers', () => {
      const result = extractCorrectIdentifierBySemver(
        ['somePkg@0.0.1', 'otherPkg@1.2.3'],
        'pkg@0.0.1',
      );
      expect(result).toBe('pkg@0.0.1');
    });
    it('should correctly return pkg if only one matching name in list', () => {
      const result = extractCorrectIdentifierBySemver(
        ['somePkg@0.0.1', 'otherPkg@1.2.3', 'pkg@1.2.1'],
        'pkg@^1.0.1',
      );
      expect(result).toBe('pkg@1.2.1');
    });
    it('should correctly return pkg if matching name and satisfied semver', () => {
      const result = extractCorrectIdentifierBySemver(
        ['somePkg@0.0.1', 'otherPkg@1.2.3', 'pkg@2.0.1', 'pkg@0.2.1'],
        'pkg@~2.0.0',
      );
      expect(result).toBe('pkg@2.0.1');
    });
    it('should correctly return pkg with greatest matching semver if multiple exist', () => {
      const result = extractCorrectIdentifierBySemver(
        ['somePkg@0.0.1', 'otherPkg@1.2.3', 'pkg@2.0.1', 'pkg@2.0.10'],
        'pkg@~2.0.0',
      );
      expect(result).toBe('pkg@2.0.10');
    });
  });
});
