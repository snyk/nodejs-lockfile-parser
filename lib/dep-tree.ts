import { LockfileType, PkgTree } from './parsers';
import {
  getFilesContent,
  getLockFileParser,
  parseManifestAndLock,
} from './common';

export async function buildDepTree(
  manifestFileContents: string,
  lockFileContents: string,
  includeDev = false,
  lockfileType?: LockfileType,
  strict: boolean = true,
  defaultManifestFileName?: string,
): Promise<PkgTree> {
  const lockfileParser = getLockFileParser(lockFileContents, lockfileType);
  const { manifestFile, lockFile } = parseManifestAndLock(
    manifestFileContents,
    lockFileContents,
    lockfileParser,
    defaultManifestFileName,
  );

  return lockfileParser.getDependencyTree(
    manifestFile,
    lockFile,
    includeDev,
    strict,
  );
}

export async function buildDepTreeFromFiles(
  root: string,
  manifestFilePath: string,
  lockFilePath: string,
  includeDev = false,
  strict = true,
): Promise<PkgTree> {
  const {
    manifestFileContents,
    lockFileContents,
    lockFileType,
  } = getFilesContent(root, manifestFilePath, lockFilePath);

  return await buildDepTree(
    manifestFileContents,
    lockFileContents,
    includeDev,
    lockFileType,
    strict,
    manifestFilePath,
  );
}
