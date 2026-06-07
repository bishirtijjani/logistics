const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Web-only: react-native-maps has no web build (it imports RN native internals).
// Redirect it to a Google Maps JS-backed shim ONLY when bundling for web. Native
// (ios/android) resolution falls through to Metro's default resolver untouched,
// so the real react-native-maps is bundled exactly as before.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-maps") {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "src/shims/react-native-maps.web.js"),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
