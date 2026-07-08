import { getTraceId } from '@defra/hapi-tracing'
import { dlqClient } from '../common/clients/dlq-client.js'

const DLQ_EVENTS_PATH = '/dlq-events'
const PAGE_LIMIT = 20
const TITLE = 'DLQ process'
const ACTIONS = new Set(['replay-all', 'delete-all'])

/** Pretty-print a raw message body if it is JSON, otherwise return it as-is. */
function prettyBody(body) {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

function toRow(message) {
  return {
    id: message.id,
    messageGroupId: message.message_group_id,
    bodyJson: prettyBody(message.body)
  }
}

/** Build the success/error banner from the post-redirect query, if any. */
function banner(query) {
  if (query.replayed) {
    return {
      type: 'success',
      text: 'Replay-all started. Messages will move back onto the source queue shortly.'
    }
  }
  if (query.deleted) {
    return {
      type: 'success',
      text: 'Delete-all started. The queue may take up to a minute to clear.'
    }
  }
  if (query.error === 'action-failed') {
    return {
      type: 'error',
      text: 'There was a problem contacting the gateway. Please try again.'
    }
  }
  if (query.error === 'invalid-action') {
    return {
      type: 'error',
      text: 'That was not a recognised action. Please try again.'
    }
  }
  return null
}

export const dlqEventsController = {
  async handler(request, h) {
    const traceId = getTraceId() ?? ''

    let response
    try {
      response = await dlqClient.list(traceId, { limit: PAGE_LIMIT })
    } catch {
      return h.view('dlq-events/index', {
        pageTitle: TITLE,
        heading: TITLE,
        breadcrumbs: [{ text: 'Home', href: '/' }, { text: TITLE }],
        messages: [],
        approximateCount: 0,
        banner: {
          type: 'error',
          text: 'There was a problem contacting the gateway. Please try again.'
        }
      })
    }

    const messages = (response?.messages ?? []).map(toRow)

    return h.view('dlq-events/index', {
      pageTitle: TITLE,
      heading: TITLE,
      breadcrumbs: [{ text: 'Home', href: '/' }, { text: TITLE }],
      messages,
      approximateCount: response?.approximate_count ?? 0,
      banner: banner(request.query)
    })
  }
}

export const dlqEventsActionController = {
  async handler(request, h) {
    const traceId = getTraceId() ?? ''
    const action = request.payload?.action

    if (!ACTIONS.has(action)) {
      return h.redirect(`${DLQ_EVENTS_PATH}?error=invalid-action`)
    }

    try {
      if (action === 'delete-all') {
        await dlqClient.deleteAll(traceId)
        return h.redirect(`${DLQ_EVENTS_PATH}?deleted=1`)
      }
      await dlqClient.replayAll(traceId)
      return h.redirect(`${DLQ_EVENTS_PATH}?replayed=1`)
    } catch {
      return h.redirect(`${DLQ_EVENTS_PATH}?error=action-failed`)
    }
  }
}
