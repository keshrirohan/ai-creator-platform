const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^convex/(.*)$": "<rootDir>/__mocks__/convex/$1",
  },
  testMatch: ["**/__tests__/**/*.test.{js,jsx}"],
  collectCoverageFrom: [
    "lib/**/*.{js,jsx}",
    "hooks/**/*.{js,jsx}",
    "components/**/*.{js,jsx}",
    "convex/**/*.js",
    "app/actions/**/*.js",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
  coverageReporters: ["text", "lcov", "html"],
  transformIgnorePatterns: ["/node_modules/(?!(convex)/)"],
};

module.exports = createJestConfig(customJestConfig);
