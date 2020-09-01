// import * as yaml from 'yaml';
//
// import { LockfileType } from './';
// import getRuntimeVersion from '../get-node-runtime-version';
// import { InvalidUserInputError, UnsupportedRuntimeError } from '../errors';
// import { YarnLockBase, YarnLockDeps } from './yarn-lock-parse-base';
// import { YarnLockParseBase } from './yarn-lock-parse-base';
// import {
//   YarnLockFileKeyNormalizer,
//   yarnLockFileKeyNormalizer,
// } from './yarn-utils';
//
// export type Yarn2Lock = YarnLockBase<LockfileType.yarn2>;
//
// export class Yarn2LockParser extends YarnLockParseBase<LockfileType.yarn2> {
//   private keyNormalizer: YarnLockFileKeyNormalizer;
//
//   constructor() {
//     super(LockfileType.yarn2);
//     // @yarnpkg/core doesn't work with Node.js < 10
//     if (getRuntimeVersion() < 10) {
//       throw new UnsupportedRuntimeError(
//         `yarn.lock parsing is supported for Node.js v10 and higher.`,
//       );
//     }
//     const structUtils = require('@yarnpkg/core').structUtils;
//     const parseDescriptor = structUtils.parseDescriptor;
//     const parseRange = structUtils.parseRange;
//     this.keyNormalizer = yarnLockFileKeyNormalizer(parseDescriptor, parseRange);
//   }
//
//   public parseLockFile(lockFileContents: string): Yarn2Lock {
//     try {
//       const rawYarnLock: any = yaml.parse(lockFileContents);
//       delete rawYarnLock.__metadata;
//       const dependencies: YarnLockDeps = {};
//       Object.entries(rawYarnLock).forEach(
//         ([fullDescriptor, versionData]: [string, any]) => {
//           this.keyNormalizer(fullDescriptor).forEach((descriptor) => {
//             dependencies[descriptor] = versionData;
//           });
//         },
//       );
//       return {
//         dependencies,
//         lockfileType: LockfileType.yarn2,
//         object: dependencies,
//         type: LockfileType.yarn2,
//       };
//     } catch (e) {
//       throw new InvalidUserInputError(
//         `yarn.lock parsing failed with an error: ${e.message}`,
//       );
//     }
//   }
// }
