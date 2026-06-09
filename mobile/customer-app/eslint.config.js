/**
 * Mobile customer-app ESLint flat config.
 *
 * The only rule we enforce here today is the api-path contract from Phase 0:
 * every `api.<method>(...)` call must use a path that begins with "/".
 * This catches a regression that has bitten us before - relative paths get
 * concatenated against the wrong base URL and produce 404s in production.
 */

module.exports = [
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        // String literal path that does not start with "/".
        {
          selector:
            "CallExpression[callee.object.name='api'][callee.property.name=/^(get|post|put|patch|delete)$/] > Literal:first-child:not([value=/^\\//])",
          message:
            "API client paths must start with '/' (e.g. api.get('/wallet'), not api.get('wallet')).",
        },
        // Template literal path whose first quasi cooked value does not start with "/".
        {
          selector:
            "CallExpression[callee.object.name='api'][callee.property.name=/^(get|post|put|patch|delete)$/] > TemplateLiteral:first-child > TemplateElement.quasis:first-child:not([value.cooked=/^\\//])",
          message:
            "API client template-literal paths must start with '/' (e.g. api.get(`/wallet/${id}`)).",
        },
      ],
    },
  },
];
