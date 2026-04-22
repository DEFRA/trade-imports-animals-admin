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
      const error = new Error(
        'Failed to get all notification reference numbers'
      )
      error.status = response.status
      error.statusText = response.statusText

      logger.error(
        `Failed to get all notification reference numbers: ${error.message}`
      )

      throw error
    }

    return response.json()
  },

  /**
   * Retrieves a single notification with its accompanying documents
   */
  async getByRef(referenceNumber, traceId) {
    const response = await fetch(
      `${tradeImportsAnimalsBackendUrl}/notifications/${referenceNumber}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          [tracingHeader]: traceId
        }
      }
    )

    if (!response.ok) {
      const error = new Error(`Failed to get notification ${referenceNumber}`)
      error.status = response.status
      error.statusText = response.statusText
      logger.error(
        `Failed to get notification ${referenceNumber}: ${response.status}`
      )
      throw error
    }

    return response.json()
  },

  /**
   * Streams the document file for an upload session from the backend (which fetches from S3).
   * Returns the raw fetch Response so the caller can pipe headers and body.
   */
  async streamFile(uploadId, traceId) {
    const response = await fetch(
      `${tradeImportsAnimalsBackendUrl}/document-uploads/${uploadId}/file`,
      {
        method: 'GET',
        headers: {
          [tracingHeader]: traceId
        }
      }
    )

    if (!response.ok) {
      const error = new Error(`Failed to stream file for upload ${uploadId}`)
      error.status = response.status
      error.statusText = response.statusText
      logger.error(`Failed to stream file: ${response.status}`)
      throw error
    }

    return response
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
      const error = new Error('Failed to delete notifications')
      error.status = response.status
      error.statusText = response.statusText
      logger.error(`Failed to delete notifications: ${error.message}`)
      throw error
    }
  }
}
