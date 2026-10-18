import { RuleTester } from 'eslint'

import { codeQuality } from './code-quality.js'

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' }
})

ruleTester.run(
  'no-tracking-references',
  codeQuality.rules['no-tracking-references'],
  {
    valid: [
      '// Returns the postcode in upper case',
      "describe('address lookup', () => {})",
      "const id = 'EUDPA-123'",
      "const reference = 'inc-104'",
      "const uuid = '0b6c2d-123e4567-e89b-12d3'"
    ],
    invalid: [
      {
        code: '// EUDPA-390: decide the search mode',
        errors: [{ messageId: 'inComment' }]
      },
      {
        code: '/* keeps the c-201 sense */',
        errors: [{ messageId: 'inComment' }]
      },
      {
        code: '// Design Release 2.1 layout',
        errors: [{ messageId: 'inComment' }]
      },
      {
        code: '// DR2.1 parity',
        errors: [{ messageId: 'inComment' }]
      },
      {
        code: '// Ruled by the team',
        errors: [{ messageId: 'inComment' }]
      },
      {
        code: '// matches the real service',
        errors: [{ messageId: 'inComment' }]
      },
      {
        code: "describe('#router EUDPA-390 gating', () => {})",
        errors: [{ messageId: 'inTestTitle' }]
      },
      {
        code: "test.describe('inc-113 outstanding items', () => {})",
        errors: [{ messageId: 'inTestTitle' }]
      },
      {
        code: 'it.each([1])(`req-001 case %s`, () => {})',
        errors: [{ messageId: 'inTestTitle' }]
      }
    ]
  }
)

ruleTester.run('no-silent-catch', codeQuality.rules['no-silent-catch'], {
  valid: [
    'promise.catch((err) => logger.warn({ err }, "Could not record"))',
    'promise.catch(handleFailure)'
  ],
  invalid: [
    {
      code: 'promise.catch(() => undefined)',
      errors: [{ messageId: 'silent' }]
    },
    {
      code: 'promise.catch(() => {})',
      errors: [{ messageId: 'silent' }]
    },
    {
      code: 'promise.catch(function () {})',
      errors: [{ messageId: 'silent' }]
    }
  ]
})

ruleTester.run(
  'no-message-only-error-log',
  codeQuality.rules['no-message-only-error-log'],
  {
    valid: [
      "try { run() } catch (err) { logger.error({ err }, 'Run failed') }",
      "try { run() } catch (err) { request.logger.warn({ err, id }, 'Run failed') }",
      "logger.error('Started without a key')",
      "try { run() } catch { logger.warn('Run failed') }",
      "try { run() } catch (err) { console.info('Run failed') }"
    ],
    invalid: [
      {
        code: "try { run() } catch (err) { logger.error('Run failed') }",
        errors: [{ messageId: 'stringOnly' }]
      },
      {
        code: `try { run() } catch (error) { request.logger.warn(\`Run failed: \${error.message}\`) }`,
        errors: [{ messageId: 'stringOnly' }]
      },
      {
        code: "promise.catch((err) => h.logger.error('Run failed'))",
        errors: [{ messageId: 'stringOnly' }]
      }
    ]
  }
)
