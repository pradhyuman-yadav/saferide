/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',

  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // @/ → src/, @app/ → app/
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/app/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Transform ES-module packages through Babel
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      '(jest-)?react-native' +
      '|@react-native(-community)?' +
      '|expo(nent)?' +
      '|@expo(nent)?(/.*)?'  +
      '|expo-modules-core'  +
      '|@expo-google-fonts(/.*)?'  +
      '|react-navigation' +
      '|@react-navigation(/.*)?'  +
      '|@unimodules(/.*)?'  +
      '|sentry-expo' +
      '|native-base' +
      '|react-native-svg' +
      '|lucide-react-native' +
      '|firebase(/.*)?'  +
      '|zustand' +
      '|expo-location' +
      '|expo-task-manager' +
      '|expo-secure-store' +
      '|expo-notifications' +
      '|expo-linking' +
      '|expo-localization' +
      ')/)',
  ],

  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
  ],

  coverageThreshold: {
    global: {
      // Branch coverage is limited by the driver trip screen (1179-line map/animation
      // component with GPS callbacks and animated values — not coverable in unit tests).
      branches:   59,
      functions:  70,
      lines:      70,
      statements: 70,
    },
  },

  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/assets/',
    'jest.setup.ts',
  ],
};
