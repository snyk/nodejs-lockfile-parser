import { eventLoopSpinner } from 'event-loop-spinner';

export const extractPkgsFromYarnLockV1 = async (
  yarnLockContent: string,
  options: { includeOptionalDeps: boolean },
) => {
  let allDeps: Record<
    string,
    {
      version: string;
      dependencies: Record<string, string>;
    }
  > = {};
  for (const newDeps of pkgDependencyGenerator(yarnLockContent, options)) {
    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }
    allDeps = { ...allDeps, ...newDeps };
  }
  return allDeps;
};

function* pkgDependencyGenerator(
  yarnLockContent: string,
  options: { includeOptionalDeps: boolean },
) {
  const lines = yarnLockContent.split('\n');

  /*
    This checks three things to make sure this is the 
    first line of the dep definition:
      1. Line is non empty
      2. Line does not start with white space
      3. Line is not a comment (they are present in lockfiles)
  */
  const isLineStartOfDepBlock = (line: string) => {
    return line && !/\s/.test(line[0]) && line[0] !== '#';
  };

  /*
    This checks if we are on the version line
  */
  const isLineContainingVersion = (line: string) => {
    return line.trimStart().startsWith('version');
  };

  /*
    This checks if we are on the line starting the dependency
    definitions
  */
  const isLineStartOfDependencies = (line: string) => {
    return line.includes('dependencies:');
  };
  /*
    This checks if we are on the line starting the optional dependency
    definitions
  */
  const isLineStartOfOptDependencies = (line: string) => {
    return line.includes('optionalDependencies:');
  };

  /*
    This checks if current line has a matching indent size
  */
  const matchesFrontWhitespace = (line: string, whitespaceCount: number) => {
    return line.search(/\S/) === whitespaceCount;
  };

  while (lines.length) {
    const line = lines.shift() as string;

    // Once we find a block we look at the next lines until we
    // get to the next dep block. We also store the keys from
    // the line itself
    if (isLineStartOfDepBlock(line)) {
      const dependencyKeys = line.split(',').map((key) => {
        return key
          .trim()
          .replace(new RegExp(':', 'g'), (_match, offset, string) => {
            if (offset === string.length - 1) {
              return '';
            }
            return ':';
          })
          .replace(new RegExp('"', 'g'), '');
      });
      let version: string = '';
      const dependencies: Record<string, string> = {};

      while (lines.length && !isLineStartOfDepBlock(lines[0])) {
        const lineInDepBlock = lines.shift() as string;

        if (isLineContainingVersion(lineInDepBlock)) {
          const resolvedVersion = lineInDepBlock
            .replace(new RegExp('version', 'g'), '')
            .replace(new RegExp('"', 'g'), '')
            .trim();
          version = resolvedVersion;
        }

        if (isLineStartOfDependencies(lineInDepBlock)) {
          const dependencyFrontWhitespaceCount = lines[0].search(/\S/);
          while (
            lines.length &&
            matchesFrontWhitespace(lines[0], dependencyFrontWhitespaceCount)
          ) {
            const dependencyLine = lines.shift() as string;
            const [
              dependencyName,
              dependencyVersionWithQualifiers,
            ] = dependencyLine
              .trimStart()
              .replace(new RegExp('"', 'g'), '')
              .split(/(?<=^\S+)\s/);
            dependencies[dependencyName] = dependencyVersionWithQualifiers;
          }
        }
        if (
          options.includeOptionalDeps &&
          isLineStartOfOptDependencies(lineInDepBlock)
        ) {
          const dependencyFrontWhitespaceCount = lines[0].search(/\S/);
          while (
            lines.length &&
            matchesFrontWhitespace(lines[0], dependencyFrontWhitespaceCount)
          ) {
            const dependencyLine = lines.shift() as string;
            const [
              dependencyName,
              dependencyVersionWithQualifiers,
            ] = dependencyLine
              .trimStart()
              .replace(new RegExp('"', 'g'), '')
              .split(/(?<=^\S+)\s/);
            dependencies[dependencyName] = dependencyVersionWithQualifiers;
          }
        }
      }

      const uniqueDepEntries = dependencyKeys.reduce((acc, key) => {
        return { ...acc, [key]: { version, dependencies } };
      }, {});

      yield uniqueDepEntries;
      continue;
    }
  }
}
