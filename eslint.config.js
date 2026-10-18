import path from 'node:path'

import { includeIgnoreFile } from 'eslint/config'
import { neostandard } from 'neostandard'

import { codeQuality } from './eslint-rules/code-quality.js'

// neostandard 0.14 scopes its `ignores` option to its own layers, so the
// gitignored paths (.public, coverage, .cache) need an explicit global ignore.
export default [
  includeIgnoreFile(path.join(import.meta.dirname, '.gitignore')),
  ...neostandard({
    env: ['node', 'vitest'],
    noJsx: true,
    noStyle: true
  }),
  {
    files: ['**/*.{js,cjs,mjs}'],
    plugins: { 'code-quality': codeQuality },
    rules: {
      'code-quality/no-tracking-references': 'error',
      'code-quality/no-silent-catch': 'error',
      'code-quality/no-message-only-error-log': 'error'
    }
  }
]
