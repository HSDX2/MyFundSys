module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@unimodules/.*|react-native-paper|react-native-vector-icons|react-native-safe-area-context|react-native-screens|react-native-svg|react-native-chart-kit|@react-native-async-storage|@supabase|unimodules|sentry-expo|native-base)',
  ],
  setupFiles: ['./jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testPathIgnorePatterns: ['/node_modules/'],
};
