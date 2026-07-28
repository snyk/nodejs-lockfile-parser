import { PnpmLockfileParser } from './lockfile-parser';
import { LockfileV6Parser } from './lockfile-v6';
import { LockfileV5Parser } from './lockfile-v5';
import { LockfileV9Parser } from './lockfile-v9';
import { PnpmWorkspaceArgs } from '../../types';
import { OpenSourceEcosystems } from '@snyk/error-catalog-nodejs-public';
import { NodeLockfileVersion, loadYamlOrNull } from '../../../utils';
import { InvalidUserInputError } from '../../../errors';

export function getPnpmLockfileParser(
  pnpmLockContent: string | undefined,
  lockfileVersion?: NodeLockfileVersion,
  workspaceArgs?: PnpmWorkspaceArgs,
): PnpmLockfileParser {
  // In case of no dependencies, pnpm@7 (lokfile version 5)
  // does not create a lockfile at `pnpm install`
  // so if there is no lockfile content, default to lockfile version 5
  if (!pnpmLockContent) {
    return new LockfileV5Parser(pnpmLockContent, workspaceArgs);
  }
  const rawPnpmLock = loadYamlOrNull<any>(pnpmLockContent);
  // A lockfile that parses to anything other than a mapping (empty,
  // comment-only, or a bare document separator) is rejected loudly rather
  // than silently building an empty dependency graph.
  if (!rawPnpmLock || typeof rawPnpmLock !== 'object') {
    throw new InvalidUserInputError(
      'pnpm-lock.yaml parsing failed: the file is empty or does not contain a YAML mapping',
    );
  }
  const version = rawPnpmLock.lockfileVersion;

  if (
    lockfileVersion === NodeLockfileVersion.PnpmLockV5 ||
    (typeof version === 'string' && version.startsWith('5'))
  ) {
    return new LockfileV5Parser(rawPnpmLock, workspaceArgs);
  }

  if (
    lockfileVersion === NodeLockfileVersion.PnpmLockV6 ||
    (typeof version === 'string' && version.startsWith('6'))
  ) {
    return new LockfileV6Parser(rawPnpmLock, workspaceArgs);
  }

  if (
    lockfileVersion === NodeLockfileVersion.PnpmLockV9 ||
    (typeof version === 'string' && version.startsWith('9'))
  ) {
    return new LockfileV9Parser(rawPnpmLock, workspaceArgs);
  }

  throw new OpenSourceEcosystems.PnpmUnsupportedLockfileVersionError(
    `The pnpm-lock.yaml lockfile version ${
      lockfileVersion ?? version
    } is not supported`,
  );
}
