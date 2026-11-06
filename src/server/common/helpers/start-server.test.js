import { createServer } from 'node:http'
import { getDefaultAutoSelectFamilyAttemptTimeout } from 'node:net'
import Wreck from '@hapi/wreck'

import { config } from '../../../config/config.js'
import { restoreConfigAfterEach } from '../test-helpers/restore-config-after-each.js'
import { restoreWreckAgentAfterEach } from '../test-helpers/restore-wreck-agent.js'
import { startServer } from './start-server.js'

describe('#startServer', () => {
  restoreConfigAfterEach(['auth.enabled', 'httpProxy', 'port'])
  restoreWreckAgentAfterEach()

  beforeEach(() => {
    config.set('auth.enabled', false)
    config.set('httpProxy', null)
    config.set('port', 3097)
  })

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

    test('Should give each address of a host one second to connect before trying the next', () => {
      expect(getDefaultAutoSelectFamilyAttemptTimeout()).toBe(1000)
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
