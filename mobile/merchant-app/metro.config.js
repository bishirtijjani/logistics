const { withNativeWind } = require("nativewind/metro");
const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// Native-only app (no PWA build) - no web shims needed. react-native-maps
// resolves to the real native module on ios/android as bundled by Metro.
module.exports = withNativeWind(config, { input: "./global.css" });