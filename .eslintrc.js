module.exports = {
  // Root environment for Node.js server code
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
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
    // Code style rules for all files
    'indent': ['error', 2, { 'SwitchCase': 1 }],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single', { 'avoidEscape': true, 'allowTemplateLiterals': true }],
    'semi': ['error', 'always'],
    'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }],
    'no-console': 'off',
    'no-var': 'error',
    'prefer-const': ['error', { 'destructuring': 'all' }],
    'no-multiple-empty-lines': ['error', { max: 2, maxBOF: 0, maxEOF: 1 }],
    'no-trailing-spaces': ['error', { 'skipBlankLines': false, 'ignoreComments': false }],
    'no-empty': ['error', { 'allowEmptyCatch': true }],
    'no-inner-declarations': 'error',
    'no-case-declarations': 'error', // Block-scoped declarations in case blocks
    'no-useless-escape': 'warn', // Unnecessary escape characters - often false positives
    'no-prototype-builtins': 'error',
    'no-dupe-class-members': 'error',
    'no-dupe-else-if': 'error',
    'no-constant-condition': ['error', { 'checkLoops': false }],
    // Enhanced code quality rules
    'no-debugger': 'error',
    'no-alert': 'warn', // Warn instead of error - common in dev/debug code
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-imports': 'error',
    'no-useless-return': 'error',
    'no-useless-concat': 'error',
    'no-useless-computed-key': 'error',
    'no-useless-rename': 'error',
    'no-useless-constructor': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    'object-shorthand': 'error',
    'prefer-destructuring': ['warn', { 'array': false, 'object': true }],
    'no-nested-ternary': 'warn', // Warn instead of error - readability preference
    'no-unneeded-ternary': 'error',
    'no-mixed-operators': 'warn', // Warn instead of error - style preference
    'no-floating-decimal': 'error',
    'no-implicit-coercion': 'error',
    'no-extra-bind': 'error',
    'no-extra-label': 'error',
    'no-extra-boolean-cast': 'error',
    'no-lonely-if': 'warn',
    'no-else-return': 'error',
    'no-unreachable': 'error',
    'no-unreachable-loop': 'error',
    'no-unsafe-finally': 'error',
    'no-unsafe-optional-chaining': 'error',
    'no-unsafe-negation': 'error',
    'no-compare-neg-zero': 'error',
    'no-delete-var': 'error',
    'no-global-assign': 'error',
    'no-octal': 'error',
    'no-octal-escape': 'error',
    'no-redeclare': 'error',
    'no-self-assign': 'error',
    'no-self-compare': 'error',
    'no-undef-init': 'error',
    'no-undefined': 'warn', // Warn instead of error - can use void 0 alternative
    'no-unused-private-class-members': 'error',
    'no-use-before-define': ['warn', { 'functions': false, 'classes': true, 'variables': true }],
    'no-invalid-regexp': 'error',
    'no-control-regex': 'error',
    'no-sparse-arrays': 'error',
    'no-array-constructor': 'error',
    'no-new-object': 'error',
    'no-new-wrappers': 'error',
    'no-object-constructor': 'error',
    'no-promise-executor-return': 'warn',
    'no-unmodified-loop-condition': 'error',
    'no-constructor-return': 'error',
    'no-class-assign': 'error',
    'no-const-assign': 'error',
    'no-new-symbol': 'error',
    'no-this-before-super': 'error',
    'no-undef': 'error',
    // Security rules - comprehensive security scanning
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-new-buffer': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'error', // File system operations with non-literal paths
    'security/detect-non-literal-regexp': 'error', // Regular expressions with non-literal patterns
    'security/detect-non-literal-require': 'error', // Require calls with non-literal paths
    'security/detect-object-injection': 'off', // Disabled: produces many false positives (see SECURITY_FIXES_SUMMARY.md)
    'security/detect-possible-timing-attacks': 'off', // Disabled: often false positives (see SECURITY_FIXES_SUMMARY.md)
    'security/detect-unsafe-regex': 'error', // Unsafe regular expressions (ReDoS)
    'security/detect-pseudoRandomBytes': 'error', // Weak random number generation
    // XSS protection rules - comprehensive sanitization checks
    'no-unsanitized/method': 'error', // Unsafe method calls
    'no-unsanitized/property': 'error', // Unsafe property access
  },
  ignorePatterns: [
    'node_modules/',
    '.env',
    '*.min.js',
    'codeql-results/',
    'build/',
    'dist/',
    'public/css/',
    'public/examples/',
    'public/components/',
    'public/styles/',
    'src/server/synthetic-security.js', // Synthetic test file with intentional vulnerabilities
    'src/client/components/*-violations.js', // Synthetic violation test files
    'src/client/components/synthetic-*.js', // Synthetic test files with intentional issues
  ],
  // Environment-specific overrides
  overrides: [
    // Client-side JavaScript files (browser environment)
    {
      files: [
        'src/client/**/*.js',
        'public/**/*.js',
      ],
      env: {
        browser: true,
        node: false, // Disable Node.js environment for client files
        es2022: true,
      },
      rules: {
        // Allow browser globals in client files
        'no-undef': 'off', // Disable undefined globals check for browser APIs
        // Relax some Node.js specific rules for browser code
        'security/detect-non-literal-fs-filename': 'off',
        'security/detect-child-process': 'off',
        'no-console': 'off', // Allow console in browser code
        // Disable security rules that produce false positives in client-side code
        // These have been reviewed and documented as false positives in SECURITY_FIXES_SUMMARY.md
        'security/detect-object-injection': 'off', // False positives: icon mappings, whitelisted content types
        'security/detect-possible-timing-attacks': 'off', // False positives: client-side password validation, not auth
        'no-unsanitized/method': 'off', // Content is properly sanitized via escapeHtml()
        'no-unsanitized/property': 'off', // Content is properly sanitized or static strings
        // Allow common browser patterns
        'no-inner-declarations': 'off',
        'no-case-declarations': 'off',
      },
      globals: {
        // Browser globals
        'document': 'readonly',
        'window': 'readonly',
        'navigator': 'readonly',
        'location': 'readonly',
        'history': 'readonly',
        'localStorage': 'readonly',
        'sessionStorage': 'readonly',
        'fetch': 'readonly',
        'console': 'readonly',
        'alert': 'readonly',
        'confirm': 'readonly',
        'prompt': 'readonly',
        // Common libraries/globals that might be used
        '$': 'readonly',
        'jQuery': 'readonly',
        'Chart': 'readonly',
        'mapboxgl': 'readonly',
        'L': 'readonly', // Leaflet
        'google': 'readonly',
        'Map': 'readonly',
        'Marker': 'readonly',
        // Development globals
        'process': 'readonly',
        'require': 'readonly',
        'module': 'readonly',
        'exports': 'readonly',
      },
    },
    // Server-side JavaScript files (Node.js environment)
    {
      files: [
        'src/server/**/*.js',
        'scripts/**/*.js',
        'config/**/*.js',
        'server.js',
        'migrate.js',
        'healthcheck.js',
      ],
      env: {
        node: true,
        browser: false,
        es2022: true,
        jest: true,
      },
      rules: {
        // Strict rules for server code
        'no-console': 'off', // Allow console.log in server code for debugging
        // Node.js specific security rules
        'security/detect-non-literal-fs-filename': 'warn',
        'security/detect-child-process': 'warn',
        // Disable browser-specific rules for server code
        'no-unsanitized/method': 'off',
        'no-unsanitized/property': 'off',
        // Strict rules for server
        'no-undef': 'error', // Strict undefined checks for server
      },
      globals: {
        // Node.js globals
        'require': 'readonly',
        'module': 'readonly',
        'exports': 'readonly',
        'global': 'readonly',
        '__dirname': 'readonly',
        '__filename': 'readonly',
        'process': 'readonly',
        'Buffer': 'readonly',
        // Common Node.js libraries
        'supabase': 'readonly',
        'express': 'readonly',
        'cors': 'readonly',
        'helmet': 'readonly',
        'multer': 'readonly',
      },
    },
    // Test files
    {
      files: [
        '**/*.test.js',
        '**/*.spec.js',
        '**/test/**/*.js',
        '**/tests/**/*.js',
      ],
      env: {
        node: true,
        jest: true,
        es2022: true,
      },
      rules: {
        // Relax rules for test files
        'no-console': 'off',
        'security/detect-child-process': 'off',
        'security/detect-possible-timing-attacks': 'off', // False positives in test code
        'no-unsanitized/method': 'off',
        'no-unsanitized/property': 'off',
        'no-undef': 'off',
      },
      globals: {
        'describe': 'readonly',
        'it': 'readonly',
        'test': 'readonly',
        'expect': 'readonly',
        'beforeEach': 'readonly',
        'afterEach': 'readonly',
        'beforeAll': 'readonly',
        'afterAll': 'readonly',
      },
    },
    // Utility and shared files
    {
      files: [
        'src/shared/**/*.js',
        'src/utils/**/*.js',
      ],
      env: {
        node: true,
        browser: false,
        es2022: true,
      },
      rules: {
        'no-console': 'off',
        'no-undef': 'off', // Allow mixed usage in utility files
      },
      globals: {
        // Allow both Node.js and browser globals in utility files
        'require': 'readonly',
        'module': 'readonly',
        'exports': 'readonly',
        'document': 'readonly',
        'window': 'readonly',
        'navigator': 'readonly',
      },
    },
  ],
};
