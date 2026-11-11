import { config } from '../../../config/config.js'
import { measuredFetch } from '../helpers/metrics/measured-fetch.js'
import { recordAdminAction } from '../helpers/metrics/admin-action-metrics.js'
import { requestFailed } from './request-failed.js'

const dynamicsGatewayUrl = config.get('dynamicsGatewayApi.baseUrl')
const tracingHeader = config.get('tracing.header')
const adminSecret = config.get('tradeImportsAnimalsAdminSecret')
const adminSecretHeader = 'Trade-Imports-Animals-Admin-Secret'
const dependency = 'dynamics-gateway'

const DLQ_PATH = '/dlq/notifications'

export const dlqClient = {
  /**
   * List a page of DLQ messages and the queue's approximate depth.
   */
  async list(traceId, { limit = 10 } = {}) {
    const url = new URL(`${dynamicsGatewayUrl}${DLQ_PATH}`)
    url.searchParams.set('limit', limit)

    const response = await measuredFetch(
      { dependency, operation: 'list-dlq' },
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
      throw requestFailed('Failed to list DLQ messages', response)
    }

    return response.json()
  },

  /**
   * Start moving every DLQ message back onto the source queue. Resolves once
   * the move has started, not when it finishes.
   */
  async replayAll(traceId) {
    const response = await measuredFetch(
      { dependency, operation: 'replay-all-dlq' },
      `${dynamicsGatewayUrl}${DLQ_PATH}/replay-all`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [tracingHeader]: traceId,
          [adminSecretHeader]: adminSecret
        }
      }
    )

    if (!response.ok) {
      throw requestFailed('Failed to start DLQ replay-all', response)
    }

    recordAdminAction('dlq.replay-all')
  },

  /**
   * Start wiping the DLQ. Resolves once the purge has started; it can take up
   * to 60 seconds to finish.
   */
  async deleteAll(traceId) {
    const response = await measuredFetch(
      { dependency, operation: 'delete-all-dlq' },
      `${dynamicsGatewayUrl}${DLQ_PATH}/delete-all`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [tracingHeader]: traceId,
          [adminSecretHeader]: adminSecret
        }
      }
    )

    if (!response.ok) {
      throw requestFailed('Failed to start DLQ delete-all', response)
    }

    recordAdminAction('dlq.delete-all')
  }
}
