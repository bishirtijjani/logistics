module.exports = function (api) {
  api.cache(true);
  // Strip every console.* call from production bundles. The dev profile
  // keeps them so engineers still see logs in Metro. Wrapped in `env.production`
  // so EAS preview builds (which use NODE_ENV=development) also keep them.
  const plugins = [];
  if (process.env.NODE_ENV === "production" || process.env.BABEL_ENV === "production") {
    plugins.push(["transform-remove-console", { exclude: ["error", "warn"] }]);
  }
  return {
    presets: ["babel-preset-expo", "nativewind/babel"],
    plugins,
  };
};
