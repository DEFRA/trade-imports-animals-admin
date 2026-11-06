import Wreck from '@hapi/wreck'

import { config } from '../../../config/config.js'
import { restoreConfigAfterEach } from '../test-helpers/restore-config-after-each.js'
import { restoreWreckAgentAfterEach } from '../test-helpers/restore-wreck-agent.js'
import { startServer } from './start-server.js'

describe('#startServer with an HTTP proxy configured', () => {
  restoreConfigAfterEach(['auth.enabled', 'httpProxy', 'port'])
  restoreWreckAgentAfterEach()

  beforeEach(() => {
    config.set('auth.enabled', false)
    config.set('httpProxy', 'http://proxy.test:3128')
    config.set('port', 3098)
  })

  test('Should leave Wreck on its own agent, which does not keep connections alive', async () => {
    const wrecksOwnAgent = Wreck.agents.http
    const server = await startServer()

    try {
      expect(Wreck.agents.http).toBe(wrecksOwnAgent)
      expect(Wreck.agents.http.keepAlive).toBe(false)
    } finally {
      await server.stop({ timeout: 0 })
    }
  })
})
