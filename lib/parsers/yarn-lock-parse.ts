import { LockfileType } from './';
import getRuntimeVersion from '../get-node-runtime-version';
import { InvalidUserInputError, UnsupportedRuntimeError } from '../errors';
import { YarnLockBase } from './yarn-lock-parse-base';
import { YarnLockParseBase } from './yarn-lock-parse-base';

export type YarnLock = YarnLockBase<LockfileType.yarn>;

export class YarnLockParser extends YarnLockParseBase<LockfileType.yarn> {
  private yarnLockfileParser: any;

  constructor() {
    super(LockfileType.yarn);
    // @yarnpkg/lockfile doesn't work with Node.js < 6 and crashes just after
    // the import, so it has to be required conditionally
    // more details at https://github.com/yarnpkg/yarn/issues/6304
    if (getRuntimeVersion() < 6) {
      throw new UnsupportedRuntimeError(
        'yarn.lock parsing is supported for ' + 'Node.js v6 and higher.',
      );
    }
    this.yarnLockfileParser = require('@yarnpkg/lockfile');
  }

  public parseLockFile(lockFileContents: string): YarnLock {
    try {
      const yarnLock: YarnLock = this.yarnLockfileParser.parse(
        lockFileContents,
      );
      yarnLock.dependencies = yarnLock.object;
      yarnLock.type = LockfileType.yarn;
      return yarnLock;
    } catch (e) {
      throw new InvalidUserInputError(
        'yarn.lock parsing failed with an ' + `error: ${e.message}`,
      );
    }
  }
}
