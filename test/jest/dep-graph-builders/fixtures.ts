import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(__dirname, `./fixtures`);

export function existsFixtureFileSync(
  fixturePath: string,
  filePath: string,
): boolean {
  return existsSync(join(fixturesDir, fixturePath, filePath));
}

export function readFixtureFileSync(
  fixturePath: string,
  filePath: string,
): string {
  return readFileSync(join(fixturesDir, fixturePath, filePath), 'utf8');
}

export function writeFixtureFileSync(
  fixturePath: string,
  filePath: string,
  content: string,
): void {
  writeFileSync(join(fixturesDir, fixturePath, filePath), content);
}
