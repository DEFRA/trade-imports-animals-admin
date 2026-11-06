import { createServer } from 'node:http'
import { vi } from 'vitest'
import Wreck from '@hapi/wreck'

import { mockAuthConfig } from '../test-helpers/mock-auth-config.js'
import { restoreWreckAgentAfterEach } from '../test-helpers/restore-wreck-agent.js'

vi.mock('../../../config/config.js', (importOriginal) =>
  mockAuthConfig(importOriginal, { authEnabled: false })
)

describe('#startServer', () => {
  let startServer

  beforeAll(async () => {
    vi.stubEnv('PORT', '3097')

    ;({ startServer } = await import('./start-server.js'))
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  restoreWreckAgentAfterEach()

  describe('When server starts', () => {
    let server

    beforeEach(async () => {
      server = await startServer()
    })

    afterEach(async () => {
      await server.stop({ timeout: 0 })
    })

    test('Should answer GET /health with success once started', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/health'
      })

      expect({
        started: server.info.started > 0,
        statusCode,
        result
      }).toEqual({
        started: true,
        statusCode: 200,
        result: { message: 'success' }
      })
    })

    test('Should send Wreck calls over kept-alive connections when no proxy is configured', () => {
      expect(Wreck.agents.http.keepAlive).toBe(true)
    })
  })

  describe('When the configured port is already in use', () => {
    let portHolder

    beforeEach(async () => {
      portHolder = createServer()
      await new Promise((resolve) => portHolder.listen(3097, resolve))
    })

    afterEach(async () => {
      await new Promise((resolve) => portHolder.close(resolve))
    })

    test('Should reject with the address-in-use error', async () => {
      await expect(startServer()).rejects.toMatchObject({
        code: 'EADDRINUSE'
      })
    })
  })
})
