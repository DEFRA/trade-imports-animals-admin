import { getTraceId } from '@defra/hapi-tracing'
import { dlqClient } from '../common/clients/dlq-client.js'

const DLQ_EVENTS_PATH = '/dlq-events'
const PAGE_LIMIT = 10
const TITLE = 'DLQ process'

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
    receiveCount: message.approximate_receive_count,
    bodyJson: prettyBody(message.body)
  }
}

/** Build the success/error banner from the post-redirect query, if any. */
function banner(query) {
  if (query.replayed) {
    return { type: 'success', text: `Replayed ${query.replayed} message(s).` }
  }
  if (query.deleted) {
    return { type: 'success', text: `Deleted ${query.deleted} message(s).` }
  }
  if (query.error === 'none-selected') {
    return { type: 'error', text: 'Select at least one message.' }
  }
  if (query.error === 'action-failed') {
    return {
      type: 'error',
      text: 'There was a problem contacting the gateway. Please try again.'
    }
  }
  return null
}

export const dlqEventsController = {
  async handler(request, h) {
    const traceId = getTraceId() ?? ''
    const response = await dlqClient.list(traceId, { limit: PAGE_LIMIT })
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
    const ids = [request.payload?.ids ?? []].flat().filter(Boolean)
    const action = request.payload?.action

    if (ids.length === 0) {
      return h.redirect(`${DLQ_EVENTS_PATH}?error=none-selected`)
    }

    try {
      if (action === 'delete') {
        await dlqClient.deleteEvents(ids, traceId)
        return h.redirect(`${DLQ_EVENTS_PATH}?deleted=${ids.length}`)
      }
      await dlqClient.replay(ids, traceId)
      return h.redirect(`${DLQ_EVENTS_PATH}?replayed=${ids.length}`)
    } catch {
      return h.redirect(`${DLQ_EVENTS_PATH}?error=action-failed`)
    }
  }
}
