import nextVitals from 'eslint-config-next/core-web-vitals';

export default [
  ...nextVitals,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      'import/no-unresolved': 'off',
      'import/named': 'off',
      'no-console': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn'
    }
  }
];
