import { LockfileType } from './parsers';
import { DepGraph } from '@snyk/dep-graph';
import {
  getFilesContent,
  getLockFileParser,
  parseManifestAndLock,
} from './common';

export async function buildDepGraph(
  manifestFileContents: string,
  lockFileContents: string,
  includeDev = false,
  lockfileType?: LockfileType,
  strict: boolean = true,
  defaultManifestFileName?: string,
): Promise<DepGraph> {
  const lockfileParser = getLockFileParser(lockFileContents, lockfileType);
  const { manifestFile, lockFile } = parseManifestAndLock(
    manifestFileContents,
    lockFileContents,
    lockfileParser,
    defaultManifestFileName,
  );

  return lockfileParser.getDepGraph(manifestFile, lockFile, includeDev, strict);
}

export async function buildDepGraphFromFiles(
  root: string,
  manifestFilePath: string,
  lockFilePath: string,
  includeDev = false,
  strict = true,
): Promise<DepGraph> {
  const {
    manifestFileContents,
    lockFileContents,
    lockFileType,
  } = getFilesContent(root, manifestFilePath, lockFilePath);

  return await buildDepGraph(
    manifestFileContents,
    lockFileContents,
    includeDev,
    lockFileType,
    strict,
    manifestFilePath,
  );
}
