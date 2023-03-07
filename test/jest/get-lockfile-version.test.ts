import { getLockfileVersionFromFile } from '../../lib/utils';

describe('getLockfileVersionFromFile', () => {
  it('npm', () => {
    const result = getLockfileVersionFromFile(
      `${__dirname}/../fixtures/bare-npm/package-lock.json`,
    );
    expect(result).toMatchSnapshot();
  });
});
