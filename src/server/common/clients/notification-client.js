import { config } from '../../../config/config.js'
import { createLogger } from '../helpers/logging/logger.js'

const tradeImportsAnimalsBackendUrl = config.get(
  'tradeImportsAnimalsBackendApi.baseUrl'
)
const tracingHeader = config.get('tracing.header')
const adminSecret = config.get('tradeImportsAnimalsAdminSecret')
const logger = createLogger()

const UPLOAD_ID_PATTERN = /^[a-zA-Z0-9-]+$/

const throwFetchError = (message, response) => {
  const error = new Error(message)
  error.status = response.status
  error.statusText = response.statusText
  logger.error(`${message}: ${response.status} ${response.statusText}`)
  throw error
}

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
      throwFetchError(
        'Failed to get all notification reference numbers',
        response
      )
    }

    return response.json()
  },

  /**
   * Retrieves a single notification with its accompanying documents
   */
  async getByRef(referenceNumber, traceId) {
    const response = await fetch(
      `${tradeImportsAnimalsBackendUrl}/notifications/${encodeURIComponent(referenceNumber)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          [tracingHeader]: traceId
        }
      }
    )

    if (!response.ok) {
      throwFetchError(`Failed to get notification ${referenceNumber}`, response)
    }

    return response.json()
  },

  /**
   * Streams the document file for an upload session from the backend (which fetches from S3).
   * Returns the raw fetch Response so the caller can pipe headers and body.
   */
  async streamFile(uploadId, traceId) {
    if (!UPLOAD_ID_PATTERN.test(uploadId)) {
      throw new Error(`Invalid uploadId: ${uploadId}`)
    }

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
      throwFetchError(`Failed to stream file for upload ${uploadId}`, response)
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
      throwFetchError('Failed to delete notifications', response)
    }
  }
}
