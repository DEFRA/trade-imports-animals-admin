import { config } from '../../../config/config.js'
import { measuredFetch } from '../helpers/metrics/measured-fetch.js'
import { recordAdminAction } from '../helpers/metrics/admin-action-metrics.js'
import { requestFailed } from './request-failed.js'

const tradeImportsAnimalsBackendUrl = config.get(
  'tradeImportsAnimalsBackendApi.baseUrl'
)
const tracingHeader = config.get('tracing.header')
const adminSecret = config.get('tradeImportsAnimalsAdminSecret')
const dependency = 'animals-backend'

export const notificationClient = {
  /**
   * Retrieves a page of notification reference numbers
   * (ReferenceNumberPageResponse: { content, page, size, numberOfElements,
   * totalElements, totalPages }). `page` is 0-based.
   */
  async getAllReferenceNumbers(_request, traceId, { page = 0 } = {}) {
    const url = new URL(
      `${tradeImportsAnimalsBackendUrl}/notifications/reference-numbers`
    )
    url.searchParams.set('page', page)

    const response = await measuredFetch(
      { dependency, operation: 'get-reference-numbers' },
      url.toString(),
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          [tracingHeader]: traceId
        }
      }
    )

    if (!response.ok) {
      throw requestFailed(
        'Failed to get all notification reference numbers',
        response
      )
    }

    return response.json()
  },

  /**
   * Retrieves all outbox events for a notification reference number
   */
  async getOutboxEvents(referenceNumber, traceId) {
    const response = await measuredFetch(
      { dependency, operation: 'get-outbox-events' },
      `${tradeImportsAnimalsBackendUrl}/notifications/${encodeURIComponent(referenceNumber)}/outbox-events`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          [tracingHeader]: traceId
        }
      }
    )

    if (!response.ok) {
      throw requestFailed('Failed to get outbox events', response)
    }

    return response.json()
  },

  /**
   * Re-publishes all outbox events for a notification in aggregate version
   * order.
   */
  async replay(referenceNumber, traceId, userId) {
    if (!userId) {
      throw new Error('userId is required to replay notifications')
    }

    const response = await measuredFetch(
      { dependency, operation: 'replay' },
      `${tradeImportsAnimalsBackendUrl}/notifications/${encodeURIComponent(referenceNumber)}/replay`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [tracingHeader]: traceId,
          'User-Id': userId,
          'Trade-Imports-Animals-Admin-Secret': adminSecret
        }
      }
    )

    if (!response.ok) {
      throw requestFailed('Failed to replay outbox events', response)
    }

    recordAdminAction('notification.replay')
    return response.json()
  },

  /**
   * Deletes notifications by reference numbers
   */
  async delete(referenceNumbers, traceId, userId) {
    if (!userId) {
      throw new Error('userId is required to delete notifications')
    }

    const response = await measuredFetch(
      { dependency, operation: 'delete' },
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
      throw requestFailed('Failed to delete notifications', response)
    }

    recordAdminAction('notification.delete')
  }
}
