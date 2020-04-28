import * as yarnLockfileParser from '@yarnpkg/lockfile';

import { LockfileType } from './';
import { InvalidUserInputError } from '../errors';
import { YarnLockBase } from './yarn-lock-parse-base';
import { YarnLockParseBase } from './yarn-lock-parse-base';

export type YarnLock = YarnLockBase<LockfileType.yarn>;

export class YarnLockParser extends YarnLockParseBase<LockfileType.yarn> {
  constructor() {
    super(LockfileType.yarn);
  }

  public parseLockFile(lockFileContents: string): YarnLock {
    try {
      const yarnLock: YarnLock = yarnLockfileParser.parse(lockFileContents);
      yarnLock.dependencies = yarnLock.object;
      yarnLock.type = LockfileType.yarn;
      return yarnLock;
    } catch (e) {
      throw new InvalidUserInputError(
        `yarn.lock parsing failed with an error: ${e.message}`,
      );
    }
  }
}
