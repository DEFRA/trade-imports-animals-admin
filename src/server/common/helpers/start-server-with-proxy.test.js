import { vi } from 'vitest'
import Wreck from '@hapi/wreck'

import { mockAuthConfig } from '../test-helpers/mock-auth-config.js'
import { restoreWreckAgentAfterEach } from '../test-helpers/restore-wreck-agent.js'

vi.mock('../../../config/config.js', (importOriginal) =>
  mockAuthConfig(importOriginal, { authEnabled: false })
)

describe('#startServer with an HTTP proxy configured', () => {
  let startServer

  beforeAll(async () => {
    vi.stubEnv('HTTP_PROXY', 'http://proxy.test:3128')
    vi.stubEnv('PORT', '3098')

    ;({ startServer } = await import('./start-server.js'))
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  restoreWreckAgentAfterEach()

  test('Should leave Wreck on its own agent, which does not keep connections alive', async () => {
    const server = await startServer()

    try {
      expect(Wreck.agents.http.keepAlive).toBe(false)
    } finally {
      await server.stop({ timeout: 0 })
    }
  })
})
