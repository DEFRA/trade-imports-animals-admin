import { createLogger } from '../helpers/logging/logger.js'

const logger = createLogger()

/**
 * Logs a refused request at error and returns the error to throw, carrying the
 * response's status and status text.
 *
 * @param {string} message - what failed
 * @param {Response} response - the refusing response
 * @returns {Error & { status: number, statusText: string }} the error
 */
export const requestFailed = (message, response) => {
  const error = new Error(message)
  error.status = response.status
  error.statusText = response.statusText
  logger.error(`${message}: ${response.status} ${response.statusText}`)
  return error
}
