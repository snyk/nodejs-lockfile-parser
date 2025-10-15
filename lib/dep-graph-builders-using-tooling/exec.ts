import * as childProcess from 'child_process';
import debugModule = require('debug');
import { Shescape } from 'shescape';

const debugLogging = debugModule('snyk-gradle-plugin');
// const shescape = new Shescape({ shell: false });

// Executes a subprocess. Resolves successfully with stdout contents if the exit code is 0.
export function execute(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv },
  perLineCallback?: (s: string) => Promise<void>,
): Promise<string> {
  const spawnOptions: childProcess.SpawnOptions = {
    shell: false,
    cwd: options?.cwd, // You can do the same for cwd
    env: { ...process.env, ...options?.env },
  };

  // args = shescape.quoteAll(args);

  // Before spawning an external process, we look if we need to restore the system proxy configuration,
  // which overides the cli internal proxy configuration.
  //
  // This top check is to satisfy ts
  if (spawnOptions.env) {
    if (process.env.SNYK_SYSTEM_HTTP_PROXY !== undefined) {
      spawnOptions.env.HTTP_PROXY = process.env.SNYK_SYSTEM_HTTP_PROXY;
    }
    if (process.env.SNYK_SYSTEM_HTTPS_PROXY !== undefined) {
      spawnOptions.env.HTTPS_PROXY = process.env.SNYK_SYSTEM_HTTPS_PROXY;
    }
    if (process.env.SNYK_SYSTEM_NO_PROXY !== undefined) {
      spawnOptions.env.NO_PROXY = process.env.SNYK_SYSTEM_NO_PROXY;
    }
  }

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const proc = childProcess.spawn(command, args, spawnOptions);

    proc.stdout?.on('data', (data: Buffer) => {
      const strData = data.toString();
      stdout = stdout + strData;
      if (perLineCallback) {
        strData.split('\n').forEach(perLineCallback);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr = stderr + data;
    });

    proc.on('close', (code: number) => {
      if (code !== 0) {
        const fullCommand = command + ' ' + args.join(' ');
        return reject(
          new Error(`
>>> command: ${fullCommand}
>>> exit code: ${code}
>>> stdout:
${stdout}
>>> stderr:
${stderr}
`),
        );
      }
      if (stderr) {
        debugLogging(
          'subprocess exit code = 0, but stderr was not empty: ' + stderr,
        );
      }

      resolve(stdout);
    });
  });
}
