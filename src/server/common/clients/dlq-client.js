import { config } from '../../../config/config.js'
import { createLogger } from '../helpers/logging/logger.js'

const dynamicsGatewayUrl = config.get('dynamicsGatewayApi.baseUrl')
const tracingHeader = config.get('tracing.header')
const adminSecret = config.get('tradeImportsAnimalsAdminSecret')
const adminSecretHeader = 'Trade-Imports-Animals-Admin-Secret'
const logger = createLogger()

const DLQ_PATH = '/dlq/notifications'

function failed(message, response) {
  const error = new Error(message)
  error.status = response.status
  error.statusText = response.statusText
  logger.error(`${message}: ${response.status} ${response.statusText}`)
  return error
}

export const dlqClient = {
  /**
   * List a page of DLQ messages (and the queue's approximate depth) from the
   * dynamics gateway. Read-only — no admin secret required.
   */
  async list(traceId, { limit = 10 } = {}) {
    const url = new URL(`${dynamicsGatewayUrl}${DLQ_PATH}`)
    url.searchParams.set('limit', limit)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        [tracingHeader]: traceId
      }
    })

    if (!response.ok) {
      throw failed('Failed to list DLQ messages', response)
    }

    return response.json()
  },

  /**
   * Replay the selected DLQ messages: the gateway re-sends each to the source
   * queue then removes it from the DLQ. Guarded by the admin secret.
   */
  async replay(ids, traceId) {
    const response = await fetch(`${dynamicsGatewayUrl}${DLQ_PATH}/replay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [tracingHeader]: traceId,
        [adminSecretHeader]: adminSecret
      },
      body: JSON.stringify({ ids })
    })

    if (!response.ok) {
      throw failed('Failed to replay DLQ messages', response)
    }
  },

  /**
   * Delete the selected DLQ messages from the dynamics gateway DLQ. Guarded by
   * the admin secret.
   */
  async deleteEvents(ids, traceId) {
    const response = await fetch(`${dynamicsGatewayUrl}${DLQ_PATH}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        [tracingHeader]: traceId,
        [adminSecretHeader]: adminSecret
      },
      body: JSON.stringify({ ids })
    })

    if (!response.ok) {
      throw failed('Failed to delete DLQ messages', response)
    }
  }
}
