import { config } from '../../../config/config.js'
import { createLogger } from '../helpers/logging/logger.js'

const tradeImportsAnimalsBackendUrl = config.get(
  'tradeImportsAnimalsBackendApi.baseUrl'
)
const tracingHeader = config.get('tracing.header')
const adminSecret = config.get('tradeImportsAnimalsAdminSecret')
const logger = createLogger()

export const notificationClient = {
  /**
   * Retrieves all notification reference numbers from the backend
   */
  async getAllReferenceNumbers(_request, traceId) {
    const response = await fetch(
      `${tradeImportsAnimalsBackendUrl}/notifications/reference-numbers`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          [tracingHeader]: traceId
        }
      }
    )

    if (!response.ok) {
      const message = 'Failed to get all notification reference numbers'
      const error = new Error(message)
      error.status = response.status
      error.statusText = response.statusText
      logger.error(`${message}: ${response.status} ${response.statusText}`)
      throw error
    }

    return response.json()
  },

  /**
   * Deletes notifications from the backend by reference numbers
   */
  async delete(referenceNumbers, traceId, userId) {
    if (!userId) {
      throw new Error('userId is required to delete notifications')
    }

    const response = await fetch(
      `${tradeImportsAnimalsBackendUrl}/notifications`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          [tracingHeader]: traceId,
          'User-Id': userId,
          'Trade-Imports-Animals-Admin-Secret': adminSecret
        },
        body: JSON.stringify(referenceNumbers)
      }
    )

    if (!response.ok) {
      const message = 'Failed to delete notifications'
      const error = new Error(message)
      error.status = response.status
      error.statusText = response.statusText
      logger.error(`${message}: ${response.status} ${response.statusText}`)
      throw error
    }
  }
}
