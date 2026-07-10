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
   * Move every DLQ message back onto the source queue via the gateway's native
   * SQS StartMessageMoveTask. Asynchronous — the gateway only starts the move.
   * Guarded by the admin secret.
   */
  async replayAll(traceId) {
    const response = await fetch(
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
      throw failed('Failed to start DLQ replay-all', response)
    }
  },

  /**
   * Wipe the DLQ via the gateway's native SQS PurgeQueue. Asynchronous — can
   * take up to 60 seconds to fully complete. Guarded by the admin secret.
   */
  async deleteAll(traceId) {
    const response = await fetch(
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
      throw failed('Failed to start DLQ delete-all', response)
    }
  }
}
