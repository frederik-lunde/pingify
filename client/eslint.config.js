import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // 1. Global ignores
  { ignores: ['dist'] },

  // 2. Main configuration for TS/TSX files
  {
    // Apply this config to TS and TSX files
    files: ['**/*.{ts,tsx}'],

    // Extend recommended configs
    extends: [
        js.configs.recommended, // ESLint recommended rules
        ...tseslint.configs.recommended, // TypeScript-ESLint recommended rules
    ],

    // Language options
    languageOptions: {
      ecmaVersion: 2020, // Or 'latest'
      sourceType: 'module', // Assuming ES modules
      globals: {
        ...globals.browser, // Include browser globals
        // Add any other global variables if needed, e.g., process: 'readonly'
      },
      // Specify parser options if needed (tseslint usually handles this)
      // parserOptions: {
      //   project: true, // If using rules requiring type info
      //   tsconfigRootDir: import.meta.dirname,
      // },
    },

    // Plugins used
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      // '@typescript-eslint': tseslint.plugin, // Often implicitly included by tseslint.configs.recommended
    },

    // Rules configuration
    rules: {
      // Include rules from the React Hooks plugin
      ...reactHooks.configs.recommended.rules,

      // Configure React Refresh rule
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // --- ADD THIS RULE ---
      // Disallow console logs (set to 'warn' or 'error')
      'no-console': 'warn', // Or 'error' for stricter enforcement

      // --- Optional: Example of disabling a TS rule if needed ---
      // '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // --- Optional: Example of configuring a TS rule ---
      // '@typescript-eslint/explicit-function-return-type': 'off', // Or 'warn'/'error'
    },
  },

  // 3. Add more specific configurations if needed (e.g., for JS files, tests)
  // {
  //   files: ['**/*.js'],
  //   extends: [js.configs.recommended],
  //   rules: {
  //     'no-console': 'warn', // Also apply to JS files if desired
  //   }
  // }
);