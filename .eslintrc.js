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
    'no-empty': 'warn', // Allow empty blocks but warn
    'no-inner-declarations': 'warn', // Allow inner declarations but warn
    'no-case-declarations': 'warn', // Allow declarations in case blocks but warn
    'no-useless-escape': 'warn', // Allow unnecessary escapes but warn
    'no-prototype-builtins': 'warn', // Allow prototype builtins but warn
    'no-dupe-class-members': 'error', // Prevent duplicate class members
    'no-dupe-else-if': 'error', // Prevent duplicate else-if conditions

    // Security rules - manually specified to avoid config issues
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'warn',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-new-buffer': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-non-literal-require': 'warn',
    'security/detect-object-injection': 'warn', // Allow but warn about object injection
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-unsafe-regex': 'warn',

    // XSS protection rules - relaxed for client code
    'no-unsanitized/method': 'warn',
    'no-unsanitized/property': 'warn',

    // Additional security rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',

    // Relaxed rules for client-side code compatibility
    'no-undef': 'off', // Allow undefined globals (browser APIs)
  },
  ignorePatterns: [
    'node_modules/',
    'public/',
    '.env',
    '*.min.js',
    'codeql-results/',
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

        // Browser-specific security rules - warn instead of error for gradual migration
        'no-unsanitized/method': 'warn',
        'no-unsanitized/property': 'warn',

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
