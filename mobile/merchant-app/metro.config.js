const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Native-only app (no PWA build) - no web shims needed. react-native-maps
// resolves to the real native module on ios/android as bundled by Metro.
module.exports = withNativeWind(config, { input: "./global.css" });
