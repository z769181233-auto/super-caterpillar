module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@scu/engines-ce06$': '<rootDir>/../../packages/engines/ce06/src/index.ts',
    '^@scu/shared-types$': '<rootDir>/../../packages/shared-types/src/index.ts',
    // Add other mappings if needed, but these are the ones used in the test/processor
  },
  testMatch: ['**/*.spec.ts'],
};
