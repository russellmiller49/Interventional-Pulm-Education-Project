import coreWebVitals from 'eslint-config-next/core-web-vitals'
import eslintConfigPrettier from 'eslint-config-prettier'
import nextTypescript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/storybook-static/**',
      '**/.contentlayer/**',
      '**/public/**',
      '**/fluoro-viewer/public/**',
      '**/fluoro-viewer/dist/**',
      'in-development/**',
      '**/.deploy_push/**',
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
  eslintConfigPrettier,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          disallowTypeAnnotations: false,
        },
      ],
      'import/no-anonymous-default-export': 'off',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'clsx',
              message: 'Use src/lib/cn.ts instead.',
            },
          ],
        },
      ],
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['src/lib/cn.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['**/*.stories.@(ts|tsx)'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    files: ['src/components/mdx/MDXRenderer.tsx'],
    rules: {
      'react-hooks/static-components': 'off',
    },
  },
]

export default config
