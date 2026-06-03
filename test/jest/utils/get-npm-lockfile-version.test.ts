// Import from the narrow modules (not the package index) so this focused unit
// test does not pull in the whole dep-graph-builder import graph.
import { getNpmLockfileVersion, NodeLockfileVersion } from '../../../lib/utils';
import { InvalidUserInputError } from '../../../lib/errors';

describe('getNpmLockfileVersion', () => {
  const validV1 = JSON.stringify({ name: 'fixture', lockfileVersion: 1 });
  const validV2 = JSON.stringify({
    name: 'fixture',
    lockfileVersion: 2,
    packages: {},
  });
  const validV3 = JSON.stringify({
    name: 'fixture',
    lockfileVersion: 3,
    packages: {},
  });
  const noVersion = JSON.stringify({ name: 'fixture' });

  describe('valid lockfiles (regression)', () => {
    it('detects V1 when lockfileVersion is 1', () => {
      expect(getNpmLockfileVersion(validV1)).toBe(
        NodeLockfileVersion.NpmLockV1,
      );
    });

    it('detects V1 when lockfileVersion is absent', () => {
      expect(getNpmLockfileVersion(noVersion)).toBe(
        NodeLockfileVersion.NpmLockV1,
      );
    });

    it('detects V2', () => {
      expect(getNpmLockfileVersion(validV2)).toBe(
        NodeLockfileVersion.NpmLockV2,
      );
    });

    it('detects V3', () => {
      expect(getNpmLockfileVersion(validV3)).toBe(
        NodeLockfileVersion.NpmLockV3,
      );
    });
  });

  describe('surfaces the underlying parse error (Defect 1)', () => {
    it('preserves the JSON syntax error instead of the old generic message', () => {
      let message = '';
      try {
        // truncated JSON
        getNpmLockfileVersion('{ "lockfileVersion": 3, ');
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toContain('package-lock.json parsing failed with error');
      // the underlying SyntaxError text must come through...
      expect(message.length).toBeGreaterThan(
        'package-lock.json parsing failed with error'.length,
      );
      // ...and the old, unhelpful message must be gone
      expect(message).not.toContain(
        'make sure the package-lock.json is a valid JSON file',
      );
    });

    it('throws an InvalidUserInputError', () => {
      expect(() => getNpmLockfileVersion('not json')).toThrow(
        InvalidUserInputError,
      );
    });

    it('hints at a leading byte-order mark (BOM)', () => {
      expect(() => getNpmLockfileVersion('﻿' + validV3)).toThrow(
        /byte-order mark/i,
      );
    });

    it('hints at NUL bytes / wide (UTF-16) encoding', () => {
      // a UTF-16LE buffer decoded as UTF-8 interleaves NUL bytes
      const utf16Decoded = Buffer.from(validV3, 'utf16le').toString('utf-8');
      expect(() => getNpmLockfileVersion(utf16Decoded)).toThrow(/UTF-16/i);
    });

    it('hints at unresolved git merge-conflict markers', () => {
      const conflicted = `<<<<<<< HEAD\n${validV3}\n=======\n{}\n>>>>>>> branch\n`;
      expect(() => getNpmLockfileVersion(conflicted)).toThrow(
        /merge-conflict markers/i,
      );
    });

    it('hints at an empty file', () => {
      expect(() => getNpmLockfileVersion('')).toThrow(/empty/i);
    });
  });

  describe('does not mask an unsupported version (Defect 2)', () => {
    it('reports the unsupported version, not a JSON parse error', () => {
      const unsupported = JSON.stringify({
        name: 'fixture',
        lockfileVersion: 99,
      });
      expect(() => getNpmLockfileVersion(unsupported)).toThrow(
        /Unsupported npm lockfile version "99"/,
      );
      expect(() => getNpmLockfileVersion(unsupported)).not.toThrow(
        /parsing failed/,
      );
    });
  });
});
