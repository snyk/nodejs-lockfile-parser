module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/test/jest/**/*.test.ts',
    '<rootDir>/test/jest/**/*.spec.ts',
  ],
  modulePathIgnorePatterns: ['<rootDir>/test/fixtures/', '<rootDir>/test/jest/'],
};
