import { config } from '../../../config/config.js'
import { createLogger } from '../helpers/logging/logger.js'

const tradeImportsAnimalsBackendUrl = config.get(
  'tradeImportsAnimalsBackendApi.baseUrl'
)
const tracingHeader = config.get('tracing.header')
const logger = createLogger()

export const notificationClient = {
  /**
   * Retrieves all notifications from the backend
   */
  async getAll(_request, traceId) {
    const response = await fetch(
      `${tradeImportsAnimalsBackendUrl}/notifications`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          [tracingHeader]: traceId
        }
      }
    )

    if (!response.ok) {
      const error = new Error('Failed to get all notifications')
      error.status = response.status
      error.statusText = response.statusText

      logger.error(`Failed to get all notifications: ${error.message}`)

      throw error
    }

    return response.json()
  },

  /**
   * Deletes notifications from the backend by reference numbers
   */
  async delete(referenceNumbers, traceId) {
    const response = await fetch(
      `${tradeImportsAnimalsBackendUrl}/notifications`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          [tracingHeader]: traceId
        },
        body: JSON.stringify(referenceNumbers)
      }
    )

    if (!response.ok) {
      const error = new Error('Failed to delete notifications')
      error.status = response.status
      error.statusText = response.statusText
      logger.error(`Failed to delete notifications: ${error.message}`)
      throw error
    }
  }
}
