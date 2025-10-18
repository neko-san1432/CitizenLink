module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
    // Add security-focused configurations
    'plugin:security/recommended',
    'plugin:no-unsanitized/DOM',
  ],
  plugins: [
    'security',
    'no-unsanitized',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // Code style rules
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'no-unused-vars': ['warn'],
    'no-console': 'off',
    'no-var': 'error',
    'prefer-const': 'error',
    'no-multiple-empty-lines': ['error', { max: 2, maxBOF: 0, maxEOF: 1 }],
    'no-trailing-spaces': 'error',

    // Security rules
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'warn',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-new-buffer': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-non-literal-require': 'warn',
    'security/detect-object-injection': 'warn',
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-unsafe-regex': 'error',
    'no-unsanitized/method': 'error',
    'no-unsanitized/property': 'error',

    // Additional security rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-unsanitized/method': 'error',
    'no-unsanitized/property': 'error',

    // Input validation
    'no-useless-escape': 'warn',

    // Buffer security
    'security/detect-buffer-noassert': 'error',
    'security/detect-new-buffer': 'error',
  },
  ignorePatterns: [
    'node_modules/',
    'public/',
    '.env',
    '*.min.js',
  ],
};
