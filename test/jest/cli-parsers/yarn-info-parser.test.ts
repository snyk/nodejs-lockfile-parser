import * as fs from 'fs';
import { parseYarnInfoOutput } from '../../../lib/cli-parsers/yarn-info-parser';

describe('parseYarnListOutput', () => {
  it('should return a correct flat map of the dependencies', () => {
    const yarnInfoOutput = fs.readFileSync(
      `${__dirname}/fixtures/yarn-info-output.txt`,
      'utf8',
    );
    const result = parseYarnInfoOutput(yarnInfoOutput);
    expect(result).toMatchSnapshot();
  });
});
