import { afterEach } from 'vitest'
import Wreck from '@hapi/wreck'

export function restoreWreckAgentAfterEach() {
  const originalAgent = Wreck.agents.http

  afterEach(() => {
    Wreck.agents.http.destroy()
    Wreck.agents.http = originalAgent
  })
}
