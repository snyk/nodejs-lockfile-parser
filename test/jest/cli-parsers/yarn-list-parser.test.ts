import * as fs from 'fs';
import { parseYarnListOutput } from '../../../lib/cli-parsers/yarn-list-parser';

describe('parseYarnListOutput', () => {
  it('should return a correct flat map of the dependencies', () => {
    const yarnListOutput = fs.readFileSync(
      `${__dirname}/fixtures/yarn-list-output.txt`,
      'utf8',
    );
    const result = parseYarnListOutput(yarnListOutput, {
      accepts: '1.3.7',
    });
    expect(result).toMatchSnapshot();
  });
});
