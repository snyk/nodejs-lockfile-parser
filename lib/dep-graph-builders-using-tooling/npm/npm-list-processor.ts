import { execute } from '../exec';
import { writeFileSync } from 'fs';
import {
  NpmListOutput,
  NpmProjectProcessorOptions,
  isNpmListOutput,
} from './types';

export async function getNpmListOutput(
  dir: string,
  options: NpmProjectProcessorOptions,
): Promise<NpmListOutput> {
  const npmListRawOutput = await execute(
    'npm',
    [
      'list',
      '--all',
      '--json',
      '--package-lock-only',
      '--omit=dev',
      '--omit=optional',
      '--omit=peer',
      ...(options.includeDevDeps ? ['--include=dev'] : []),
      ...(options.includeOptionalDeps ? ['--include=optional'] : []),
      ...(options.includePeerDeps ? ['--include=peer'] : []),
    ],
    { cwd: dir },
  );

  try {
    const parsed = JSON.parse(npmListRawOutput);
    writeFileSync('./npm-list.json', JSON.stringify(parsed, null, 2));
    if (isNpmListOutput(parsed)) {
      return parsed;
    } else {
      throw new Error(
        'Parsed JSON does not match expected NpmListOutput structure',
      );
    }
  } catch (e) {
    throw new Error('Failed to parse JSON from npm list output');
  }
}
