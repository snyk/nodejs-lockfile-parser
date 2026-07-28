import { OpenSourceEcosystems } from '@snyk/error-catalog-nodejs-public';
import { extractPkgsFromYarnLockV2, getPnpmLockfileParser } from '../../lib';
import { getPnpmLockfileVersion, NodeLockfileVersion } from '../../lib/utils';
import { Yarn2LockParser } from '../../lib/parsers/yarn2-lock-parser';
import { InvalidUserInputError } from '../../lib/errors';

// js-yaml 5 throws where js-yaml 4 returned undefined/null for document-less
// YAML, and returns '' where js-yaml 4 returned null for a bare document
// separator. These tests pin the library-owned errors for those degenerate
// lockfiles so neither a raw YAMLException nor a silently empty result can
// escape to consumers.
describe('degenerate YAML lockfile inputs', () => {
  describe('getPnpmLockfileVersion', () => {
    it.each(['', '# comment only\n', '   \n', '---\n'])(
      'throws InvalidUserInputError for document-less content %j',
      (content) => {
        expect(() => getPnpmLockfileVersion(content)).toThrow(
          InvalidUserInputError,
        );
        expect(() => getPnpmLockfileVersion(content)).toThrow(
          /pnpm-lock\.yaml parsing failed/,
        );
      },
    );

    it('throws PnpmUnsupportedLockfileVersionError when lockfileVersion is missing', () => {
      expect(() => getPnpmLockfileVersion('foo: bar\n')).toThrow(
        OpenSourceEcosystems.PnpmUnsupportedLockfileVersionError,
      );
    });
  });

  describe('getPnpmLockfileParser', () => {
    it('still falls back to the v5 parser for missing/empty-string content', () => {
      expect(() => getPnpmLockfileParser('')).not.toThrow();
      expect(() => getPnpmLockfileParser(undefined)).not.toThrow();
    });

    it.each(['# comment only\n', '   \n', '---\n'])(
      'throws InvalidUserInputError for document-less content %j',
      (content) => {
        expect(() => getPnpmLockfileParser(content)).toThrow(
          InvalidUserInputError,
        );
      },
    );

    it('does not silently return an empty parser for a bare document separator with an explicit version', () => {
      expect(() =>
        getPnpmLockfileParser('---\n', NodeLockfileVersion.PnpmLockV5),
      ).toThrow(InvalidUserInputError);
    });

    it('throws PnpmUnsupportedLockfileVersionError when lockfileVersion is missing', () => {
      expect(() => getPnpmLockfileParser('foo: bar\n')).toThrow(
        OpenSourceEcosystems.PnpmUnsupportedLockfileVersionError,
      );
    });
  });

  describe('extractPkgsFromYarnLockV2', () => {
    it.each(['', '# comment only\n', '   \n', '---\n'])(
      'throws InvalidUserInputError instead of yielding an empty package map for %j',
      (content) => {
        expect(() => extractPkgsFromYarnLockV2(content)).toThrow(
          InvalidUserInputError,
        );
        expect(() => extractPkgsFromYarnLockV2(content)).toThrow(
          /yarn\.lock parsing failed/,
        );
      },
    );
  });

  describe('Yarn2LockParser.parseLockFile', () => {
    it.each(['', '# comment only\n', '   \n', '---\n'])(
      'throws InvalidUserInputError for document-less content %j',
      (content) => {
        const parser = new Yarn2LockParser();
        expect(() => parser.parseLockFile(content)).toThrow(
          InvalidUserInputError,
        );
        expect(() => parser.parseLockFile(content)).toThrow(
          /yarn\.lock parsing failed with an error/,
        );
      },
    );
  });
});
