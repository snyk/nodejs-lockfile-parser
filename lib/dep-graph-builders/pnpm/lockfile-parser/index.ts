import { load, FAILSAFE_SCHEMA } from 'js-yaml';
import { PnpmLockfileParser } from './lockfile-parser';
import { LockfileV6Parser } from './lockfile-v6';
import { LockfileV5Parser } from './lockfile-v5';
import { LockfileV9Parser } from './lockfile-v9';
import { PnpmWorkspaceArgs } from '../../types';
import { OpenSourceEcosystems } from '@snyk/error-catalog-nodejs-public';
import { NodeLockfileVersion } from '../../../utils';

export function getPnpmLockfileParser(
  pnpmLockContent: string,
  lockfileVersion?: NodeLockfileVersion,
  workspaceArgs?: PnpmWorkspaceArgs,
): PnpmLockfileParser {
  const rawPnpmLock = load(pnpmLockContent, {
    json: true,
    schema: FAILSAFE_SCHEMA,
  });
  const version = rawPnpmLock.lockfileVersion;

  if (
    lockfileVersion === NodeLockfileVersion.PnpmLockV5 ||
    version.startsWith('5')
  ) {
    return new LockfileV5Parser(rawPnpmLock, workspaceArgs);
  }

  if (
    lockfileVersion === NodeLockfileVersion.PnpmLockV6 ||
    version.startsWith('6')
  ) {
    return new LockfileV6Parser(rawPnpmLock, workspaceArgs);
  }

  if (
    lockfileVersion === NodeLockfileVersion.PnpmLockV9 ||
    version.startsWith('9')
  ) {
    return new LockfileV9Parser(rawPnpmLock, workspaceArgs);
  }

  throw new OpenSourceEcosystems.PnpmUnsupportedLockfileVersionError(
    `The pnpm-lock.yaml lockfile version ${lockfileVersion} is not supported`,
  );
}
