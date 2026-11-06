import { afterEach, beforeEach } from 'vitest'

import { config } from '../../../config/config.js'
import { createServer } from '../../server.js'
import { restoreConfigAfterEach } from './restore-config-after-each.js'

/**
 * Starts a server with auth enabled before each test of the enclosing
 * `describe`, stops it after, and restores `auth.enabled`.
 *
 * @returns {{ server: import('@hapi/hapi').Server }} the server of the running test
 */
export const useAuthEnabledServer = () => {
  const running = {}

  restoreConfigAfterEach(['auth.enabled'])

  beforeEach(async () => {
    config.set('auth.enabled', true)
    running.server = await createServer()
    await running.server.initialize()
  })

  afterEach(async () => {
    await running.server.stop({ timeout: 0 })
  })

  return running
}
