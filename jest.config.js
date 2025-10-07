module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/test/jest/**/*.test.ts',
    '<rootDir>/test/jest/**/*.spec.ts',
    '<rootDir>/test/integration/**/*.test.ts',
    '<rootDir>/test/integration/**/*.spec.ts',
  ],
};
