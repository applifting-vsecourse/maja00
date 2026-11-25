// Integration tests: `*.int-spec.ts`, real AppModule over HTTP (supertest)
// against the `quacker_test` database. Unit tests (`*.spec.ts`) use the
// config in package.json and never touch a database.
/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'json', 'ts', 'tsx'],
  rootDir: './',
  testRegex: '\\.int-spec\\.ts$',
  transform: {
    // .tsx: the email templates, pulled in by AppModule.
    '^.+\\.tsx?$': 'ts-jest',
    // BetterAuth and its dependencies are ES modules; see the transformer.
    '^.+\\.m?js$': '<rootDir>/src/test/integration/esm-transformer.js',
  },
  transformIgnorePatterns: [],
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  globalSetup: '<rootDir>/src/test/integration/global-setup.ts',
  setupFiles: ['<rootDir>/src/test/integration/setup-env.ts'],
  // One database shared by all files: run them one after another.
  maxWorkers: 1,
  testTimeout: 30000,
};
