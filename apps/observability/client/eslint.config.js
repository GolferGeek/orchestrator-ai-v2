import eslint from '@eslint/js';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import tseslint from 'typescript-eslint';

const browserGlobals = {
  ...globals.browser,
  ...globals.es2021,
};

const sharedTypeScriptRules = {
  '@typescript-eslint/no-unused-vars': [
    'warn',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    },
  ],
  '@typescript-eslint/no-empty-object-type': 'warn',
  '@typescript-eslint/no-duplicate-enum-values': 'warn',
  '@typescript-eslint/no-unused-expressions': 'warn',
  '@typescript-eslint/ban-ts-comment': 'warn',
  'prefer-const': 'warn',
  'no-prototype-builtins': 'warn',
};

const vueFlatRecommended = pluginVue.configs['flat/recommended'];

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
    ],
  },
  ...vueFlatRecommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      globals: browserGlobals,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: sharedTypeScriptRules,
  },
  {
    files: ['**/*.vue'],
    extends: [
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
      globals: browserGlobals,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      vue: pluginVue,
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...sharedTypeScriptRules,
      'vue/multi-word-component-names': 'off',
      'vue/html-self-closing': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/v-on-event-hyphenation': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-spacing': 'off',
      'vue/attributes-order': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/no-unused-vars': 'warn',
      'vue/no-mutating-props': 'warn',
      'vue/require-default-prop': 'warn',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx', '**/__tests__/**/*.ts'],
    languageOptions: {
      globals: {
        ...browserGlobals,
        ...globals.jest,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
);
