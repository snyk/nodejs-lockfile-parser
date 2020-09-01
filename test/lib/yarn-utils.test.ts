// #!/usr/bin/env node_modules/.bin/ts-node
// // Shebang is required, and file *has* to be executable: chmod +x file.test.js
// // See: https://github.com/tapjs/node-tap/issues/313#issuecomment-250067741
// import { test } from 'tap';
// import { yarnLockFileKeyNormalizer } from '../../lib/parsers/yarn-utils';
// import getRuntimeVersion from '../../lib/get-node-runtime-version';
//
// if (getRuntimeVersion() >= 10) {
//   const structUtils = require('@yarnpkg/core').structUtils;
//   const parseDescriptor = structUtils.parseDescriptor;
//   const parseRange = structUtils.parseRange;
//   const normalizer = yarnLockFileKeyNormalizer(parseDescriptor, parseRange);
//
//   test('Should work for star resolution', async (t) => {
//     const keys = normalizer('npm-packlist@*');
//     t.deepEqual(keys, new Set(['npm-packlist@*']), 'Resolution is normalized');
//   });
//
//   test('Should work for star resolution with npm protocol', async (t) => {
//     const keys = normalizer('npm-packlist@npm:*');
//     t.deepEqual(
//       keys,
//       new Set(['npm-packlist@*', 'npm-packlist@npm:*']),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for semver resolution with npm protocol', async (t) => {
//     const keys = normalizer('npm-packlist@npm:^1.1.6');
//     t.deepEqual(
//       keys,
//       new Set(['npm-packlist@^1.1.6', 'npm-packlist@npm:^1.1.6']),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for semver resolution with npm protocol - multiple resolutions', async (t) => {
//     const keys = normalizer('npm-packlist@npm:^1.1.6, npm-packlist@npm:^1.1.8');
//     t.deepEqual(
//       keys,
//       new Set([
//         'npm-packlist@^1.1.6',
//         'npm-packlist@npm:^1.1.6',
//         'npm-packlist@^1.1.8',
//         'npm-packlist@npm:^1.1.8',
//       ]),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for semver resolution with npm protocol and scope', async (t) => {
//     const keys = normalizer('@types/istanbul-reports@npm:^1.1.1');
//     t.deepEqual(
//       keys,
//       new Set([
//         '@types/istanbul-reports@^1.1.1',
//         '@types/istanbul-reports@npm:^1.1.1',
//       ]),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for semver resolution with npm protocol and scope - multiple resolutions', async (t) => {
//     const keys = normalizer(
//       '@types/istanbul-reports@npm:^1.1.1, @types/istanbul-reports@npm:^1.1.2',
//     );
//     t.deepEqual(
//       keys,
//       new Set([
//         '@types/istanbul-reports@^1.1.1',
//         '@types/istanbul-reports@npm:^1.1.1',
//         '@types/istanbul-reports@^1.1.2',
//         '@types/istanbul-reports@npm:^1.1.2',
//       ]),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for tag resolution with npm protocol', async (t) => {
//     const keys = normalizer('body-parser@npm:latest');
//     t.deepEqual(
//       keys,
//       new Set(['body-parser@latest', 'body-parser@npm:latest']),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for tag resolution with npm protocol and scope', async (t) => {
//     const keys = normalizer('@types/istanbul-reports@npm:latest');
//     t.deepEqual(
//       keys,
//       new Set([
//         '@types/istanbul-reports@latest',
//         '@types/istanbul-reports@npm:latest',
//       ]),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for semver without protocol', async (t) => {
//     const keys = normalizer('npm-packlist@1.1.6');
//     t.deepEqual(
//       keys,
//       new Set(['npm-packlist@1.1.6']),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for semver with scope and without protocol', async (t) => {
//     const keys = normalizer('@types/istanbul-reports@1.1.1');
//     t.deepEqual(
//       keys,
//       new Set(['@types/istanbul-reports@1.1.1']),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for tarball', async (t) => {
//     const keys = normalizer(
//       'body-parser@https://github.com/expressjs/body-parser/archive/1.9.0.tar.gz',
//     );
//     t.deepEqual(
//       keys,
//       new Set([
//         'body-parser@https://github.com/expressjs/body-parser/archive/1.9.0.tar.gz',
//       ]),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for git+ssh', async (t) => {
//     const keys = normalizer(
//       'body-parser@git+ssh://git@github.com/expressjs/body-parser.git#1.9.0"',
//     );
//     t.deepEqual(
//       keys,
//       new Set([
//         'body-parser@git+ssh://git@github.com/expressjs/body-parser.git#1.9.0"',
//       ]),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for git+http', async (t) => {
//     const keys = normalizer(
//       'body-parser@git+http://git@github.com/expressjs/body-parser.git#1.9.0"',
//     );
//     t.deepEqual(
//       keys,
//       new Set([
//         'body-parser@git+http://git@github.com/expressjs/body-parser.git#1.9.0"',
//       ]),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for git+https', async (t) => {
//     const keys = normalizer(
//       'body-parser@git+https://git@github.com/expressjs/body-parser.git#1.9.0"',
//     );
//     t.deepEqual(
//       keys,
//       new Set([
//         'body-parser@git+https://git@github.com/expressjs/body-parser.git#1.9.0"',
//       ]),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for git:', async (t) => {
//     const keys = normalizer(
//       'body-parser@git://git@github.com/expressjs/body-parser.git#1.9.0"',
//     );
//     t.deepEqual(
//       keys,
//       new Set([
//         'body-parser@git://git@github.com/expressjs/body-parser.git#1.9.0"',
//       ]),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for git@', async (t) => {
//     const keys = normalizer(
//       'body-parser@git@github.com/expressjs/body-parser.git#1.9.0"',
//     );
//     t.deepEqual(
//       keys,
//       new Set(['body-parser@git@github.com/expressjs/body-parser.git#1.9.0"']),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for patch protocol', async (t) => {
//     const keys = normalizer(
//       'left-pad@patch:left-pad@1.0.x#./my-patch.patch::locator=external-tarball%40workspace%3A.',
//     );
//     t.deepEqual(
//       keys,
//       new Set([
//         'left-pad@patch:left-pad@1.0.x#./my-patch.patch',
//         'left-pad@patch:left-pad@1.0.x#./my-patch.patch::locator=external-tarball%40workspace%3A.',
//       ]),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for patch protocol with scope', async (t) => {
//     const keys = normalizer(
//       '@types/istanbul-reports@patch:@types/istanbul-reports@1.1.1#./my-patch.patch::locator=external-tarball%40workspace%3A.',
//     );
//     t.deepEqual(
//       keys,
//       new Set([
//         '@types/istanbul-reports@patch:@types/istanbul-reports@1.1.1#./my-patch.patch',
//         '@types/istanbul-reports@patch:@types/istanbul-reports@1.1.1#./my-patch.patch::locator=external-tarball%40workspace%3A.',
//       ]),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for builtin patch protocol', async (t) => {
//     const keys = normalizer(
//       'fsevents@patch:fsevents@^1.2.7#builtin<compat/fsevents>',
//     );
//     t.deepEqual(
//       keys,
//       new Set([
//         'fsevents@^1.2.7',
//         'fsevents@patch:fsevents@^1.2.7#builtin<compat/fsevents>',
//       ]),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for builtin patch protocol - multiple resolutions', async (t) => {
//     const keys = normalizer(
//       'fsevents@patch:fsevents@^1.2.7#builtin<compat/fsevents>, fsevents@patch:fsevents@^1.2.6#builtin<compat/fsevents>',
//     );
//     t.deepEqual(
//       keys,
//       new Set([
//         'fsevents@^1.2.7',
//         'fsevents@patch:fsevents@^1.2.7#builtin<compat/fsevents>',
//         'fsevents@^1.2.6',
//         'fsevents@patch:fsevents@^1.2.6#builtin<compat/fsevents>',
//       ]),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for short github protocol with tag', async (t) => {
//     const keys = normalizer('body-parser@expressjs/body-parser#1.9.0');
//     t.deepEqual(
//       keys,
//       new Set(['body-parser@expressjs/body-parser#1.9.0']),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for short github protocol without tag', async (t) => {
//     const keys = normalizer('body-parser@expressjs/body-parser');
//     t.deepEqual(
//       keys,
//       new Set(['body-parser@expressjs/body-parser']),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for github protocol with tag', async (t) => {
//     const keys = normalizer('body-parser@github:expressjs/body-parser#1.9.0');
//     t.deepEqual(
//       keys,
//       new Set(['body-parser@github:expressjs/body-parser#1.9.0']),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for github protocol without tag', async (t) => {
//     const keys = normalizer('body-parser@github:expressjs/body-parser');
//     t.deepEqual(
//       keys,
//       new Set(['body-parser@github:expressjs/body-parser']),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for file protocol', async (t) => {
//     const keys = normalizer(
//       'shared@file:./some-file::locator=pkg-dev-deps-only%40workspace%3A.',
//     );
//     t.deepEqual(
//       keys,
//       new Set([
//         'shared@file:./some-file',
//         'shared@file:./some-file::locator=pkg-dev-deps-only%40workspace%3A.',
//         'shared@./some-file',
//       ]),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for link protocol', async (t) => {
//     const keys = normalizer(
//       'body-parser@link:../test2::locator=external-tarball%40workspace%3A.',
//     );
//     t.deepEqual(
//       keys,
//       new Set([
//         'body-parser@link:../test2',
//         'body-parser@link:../test2::locator=external-tarball%40workspace%3A.',
//       ]),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for portal protocol', async (t) => {
//     const keys = normalizer(
//       'body-parser@portal:../test2::locator=external-tarball%40workspace%3A.',
//     );
//     t.deepEqual(
//       keys,
//       new Set([
//         'body-parser@portal:../test2',
//         'body-parser@portal:../test2::locator=external-tarball%40workspace%3A.',
//       ]),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for exec protocol', async (t) => {
//     const keys = normalizer(
//       'lodash@exec:./generator.js::locator=test3%40workspace%3A.',
//     );
//     t.deepEqual(
//       keys,
//       new Set([
//         'lodash@exec:./generator.js',
//         'lodash@exec:./generator.js::locator=test3%40workspace%3A.',
//       ]),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for workspace protocol', async (t) => {
//     const keys = normalizer('@yarnpkg/builder@workspace:^2.0.0-rc.19');
//     t.deepEqual(
//       keys,
//       new Set(['@yarnpkg/builder@workspace:^2.0.0-rc.19']),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should work for virtual protocol', async (t) => {
//     const keys = normalizer('@yarnpkg/builder@virtual:^2.0.0-rc.19');
//     t.deepEqual(
//       keys,
//       new Set(['@yarnpkg/builder@virtual:^2.0.0-rc.19']),
//       'Resolution is normalized',
//     );
//   });
//
//   test('Should not fail for unknown protocol', async (t) => {
//     const keys = normalizer('@yarnpkg/builder@dummy:^2.0.0-rc.19');
//     t.deepEqual(
//       keys,
//       new Set(['@yarnpkg/builder@dummy:^2.0.0-rc.19']),
//       'Resolution is normalized',
//     );
//   });
// }
