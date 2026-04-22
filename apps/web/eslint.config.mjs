import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const legacyRelaxedFiles = [
  'src/app/**/page-old.tsx',
  'src/app/**/page-studio.tsx',
  'src/components/legacy/**/*.{ts,tsx}',
  'src/components/_legacy/**/*.{ts,tsx}',
  'src/_archive/**/*.{ts,tsx}',
  'src/app/**/studio/**/*.{ts,tsx}',
  'src/app/**/monitor/**/*.{ts,tsx}',
  'src/app/**/dev/**/*.{ts,tsx}',
  'src/app/**/tasks/[taskId]/**/*.{ts,tsx}',
  'src/lib/handleApiError.ts',
];

const legacyRelaxedIgnores = [
  'src/app/**/login/**/*.{ts,tsx}',
  'src/app/**/projects/**/pipeline/**/*.{ts,tsx}',
];

const config = [
  ...nextCoreWebVitals,
  {
    files: legacyRelaxedFiles,
    ignores: legacyRelaxedIgnores,
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'off',
      '@next/next/no-img-element': 'off',
    },
  },
];

export default config;
