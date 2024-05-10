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
        'Please provide either package-lock.json or yarn.lock.',
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
  try {
    const lockfileJson = JSON.parse(lockFileContents);
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
          `Unsupported npm lockfile version in package-lock.json. ` +
            'Please provide a package-lock.json with lockfileVersion 1, 2 or 3',
        );
    }
  } catch (e) {
    throw new InvalidUserInputError(
      `Problem parsing package-lock.json - make sure the package-lock.json is a valid JSON file`,
    );
  }
}
