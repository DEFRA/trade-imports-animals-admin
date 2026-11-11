import { afterEach, beforeEach, vi } from 'vitest'

import { createLogger } from '../helpers/logging/logger.js'

/**
 * Records the lines the module-level logger writes at one level during each
 * test of the enclosing `describe`, and restores the logger afterwards.
 *
 * @param {'info' | 'warn' | 'error'} level - the level to record
 * @returns {{ entries: () => Array<{ fields: object, message: string }>, entriesWith: (message: string) => Array<{ fields: object, message: string }> }}
 */
export const recordModuleLogger = (level) => {
  const entries = []
  let spy

  beforeEach(() => {
    entries.length = 0
    spy = vi
      .spyOn(createLogger(), level)
      .mockImplementation((fields, message) => {
        entries.push({ fields, message })
      })
  })

  afterEach(() => {
    spy.mockRestore()
  })

  return {
    entries: () => [...entries],
    entriesWith: (message) =>
      entries.filter((entry) => entry.message === message)
  }
}

/**
 * Records the info lines the module-level logger writes during each test of the
 * enclosing `describe`, and restores the logger afterwards.
 *
 * @returns {{ entries: () => Array<{ fields: object, message: string }>, entriesWith: (message: string) => Array<{ fields: object, message: string }> }}
 */
export const recordModuleLoggerInfo = () => recordModuleLogger('info')
