import { readFileSync } from 'fs';
import { load, FAILSAFE_SCHEMA } from 'js-yaml';
import { InvalidUserInputError } from './errors';
import { OpenSourceEcosystems } from '@snyk/error-catalog-nodejs-public';

export enum NodeLockfileVersion {
  NpmLockV1 = 'NPM_LOCK_V1',
  NpmLockV2 = 'NPM_LOCK_V2',
  NpmLockV3 = 'NPM_LOCK_V3',
  YarnLockV1 = 'YARN_LOCK_V1',
  YarnLockV2 = 'YARN_LOCK_V2',
  PnpmLockV5 = 'PNPM_LOCK_V5',
  PnpmLockV6 = 'PNPM_LOCK_V6',
  PnpmLockV9 = 'PNPM_LOCK_V9',
}

export const getLockfileVersionFromFile = (
  targetFile: string,
): NodeLockfileVersion => {
  const lockFileContents = readFileSync(targetFile, 'utf-8');
  if (targetFile.endsWith('package-lock.json')) {
    return getNpmLockfileVersion(lockFileContents);
  } else if (targetFile.endsWith('yarn.lock')) {
    return getYarnLockfileVersion(lockFileContents);
  } else if (targetFile.endsWith('pnpm-lock.yaml')) {
    return getPnpmLockfileVersion(lockFileContents);
  } else {
    throw new InvalidUserInputError(
      `Unknown lockfile ${targetFile}. ` +
        'Please provide either package-lock.json, yarn.lock or pnpm-lock.yaml',
    );
  }
};

export function getPnpmLockfileVersion(
  lockFileContents: string,
):
  | NodeLockfileVersion.PnpmLockV5
  | NodeLockfileVersion.PnpmLockV6
  | NodeLockfileVersion.PnpmLockV9 {
  const rawPnpmLock = load(lockFileContents, {
    json: true,
    schema: FAILSAFE_SCHEMA,
  });
  const { lockfileVersion } = rawPnpmLock;
  if (lockfileVersion.startsWith('5')) {
    return NodeLockfileVersion.PnpmLockV5;
  } else if (lockfileVersion.startsWith('6')) {
    return NodeLockfileVersion.PnpmLockV6;
  } else if (lockfileVersion.startsWith('9')) {
    return NodeLockfileVersion.PnpmLockV9;
  } else {
    throw new OpenSourceEcosystems.PnpmUnsupportedLockfileVersionError(
      `The pnpm-lock.yaml lockfile version ${lockfileVersion} is not supported`,
    );
  }
}

export function getYarnLockfileVersion(
  lockFileContents: string,
): NodeLockfileVersion.YarnLockV1 | NodeLockfileVersion.YarnLockV2 {
  if (lockFileContents.includes('__metadata')) {
    return NodeLockfileVersion.YarnLockV2;
  } else {
    return NodeLockfileVersion.YarnLockV1;
  }
}

export function getNpmLockfileVersion(
  lockFileContents: string,
):
  | NodeLockfileVersion.NpmLockV1
  | NodeLockfileVersion.NpmLockV2
  | NodeLockfileVersion.NpmLockV3 {
  // Parse first; surfacing the real JSON error happens inside parseJsonFile.
  const lockfileJson = parseJsonFile(lockFileContents, 'package-lock.json');

  // The version check runs *outside* the parse try/catch so that an
  // unsupported (but otherwise valid JSON) lockfile is not mis-reported as a
  // JSON syntax error.
  const lockfileVersion: number | null = lockfileJson.lockfileVersion || null;
  switch (lockfileVersion) {
    case null:
    case 1:
      return NodeLockfileVersion.NpmLockV1;
    case 2:
      return NodeLockfileVersion.NpmLockV2;
    case 3:
      return NodeLockfileVersion.NpmLockV3;
    default:
      throw new InvalidUserInputError(
        `Unsupported npm lockfile version "${lockfileVersion}" in package-lock.json. ` +
          'Please provide a package-lock.json with lockfileVersion 1, 2 or 3',
      );
  }
}

/**
 * Parse JSON from a manifest or lockfile. On failure throws an
 * InvalidUserInputError that preserves the underlying parser message
 * (including the position of the syntax error) and appends a best-effort hint
 * about the likely cause.
 *
 * `fileLabel` is the file kind shown in the error, e.g. 'package.json' or
 * 'package-lock.json'.
 */
export function parseJsonFile<T = any>(content: string, fileLabel: string): T {
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new InvalidUserInputError(
      `${fileLabel} parsing failed with error ${(e as Error).message}` +
        describeLikelyJsonCause(content),
    );
  }
}

/**
 * Best-effort, allocation-light hint describing the most likely reason a JSON
 * parse failed. Inspects only the leading characters of the content, never
 * throws, and returns '' when nothing recognisable is found - so it is always
 * safe to append to a parse-error message.
 */
export function describeLikelyJsonCause(content: string): string {
  if (!content) {
    return ' The file is empty.';
  }
  // A byte-order mark (UTF-8/UTF-16/UTF-32) decoded into the string.
  if (content.charCodeAt(0) === 0xfeff) {
    return ' The file begins with a byte-order mark (BOM); re-save it as UTF-8 without a BOM.';
  }
  // NUL bytes strongly suggest the file is UTF-16/UTF-32 encoded.
  if (content.includes('\x00')) {
    return ' The file contains NUL bytes; it may be UTF-16/UTF-32 encoded. Re-save it as UTF-8.';
  }
  // Unresolved git merge-conflict markers.
  if (/^(<{7}|={7}|>{7})( |$)/m.test(content)) {
    return ' The file appears to contain unresolved git merge-conflict markers.';
  }
  return '';
}
