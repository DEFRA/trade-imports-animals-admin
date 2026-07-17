import { getTraceId } from '@defra/hapi-tracing'
import { dlqClient } from '../common/clients/dlq-client.js'
import { notificationClient } from '../common/clients/notification-client.js'

const OUTBOX_EVENTS_PATH = '/outbox-events'

/** Build the post-action result banner from the query string, if any. */
function banner(query) {
  if (query.replayed) {
    return {
      type: 'success',
      text: 'All outbox events have been re-published to the SNS topic.'
    }
  }
  if (query.error === 'replay-failed') {
    return {
      type: 'error',
      text: 'There was a problem replaying the events. Please try again.'
    }
  }
  if (query.error === 'missing-ref') {
    return {
      type: 'error',
      text: 'No notification reference number was provided.'
    }
  }
  return null
}

export const outboxEventsController = {
  async handler(request, h) {
    const referenceNumber = request.query.referenceNumber?.trim() || null
    const traceId = getTraceId() ?? ''

    let events = null
    if (referenceNumber) {
      events = await notificationClient.getOutboxEvents(
        referenceNumber,
        traceId
      )
    }

    let dlqWarning = null
    if (events?.length) {
      try {
        const dlq = await dlqClient.list(traceId, { limit: 1 })
        if ((dlq?.approximate_count ?? 0) > 0) {
          dlqWarning = {
            text: `The DLQ has approximately ${dlq.approximate_count} message(s). Consider clearing or redriving them before replaying to avoid duplicate processing or silent dropping of replayed messages that are on the DLQ.`
          }
        }
      } catch (err) {
        request.logger.warn(
          { err },
          'Could not check DLQ status for warning banner'
        )
      }
    }

    const outboxEvents = 'Outbox events'
    return h.view('outbox-events/index', {
      pageTitle: outboxEvents,
      heading: outboxEvents,
      breadcrumbs: [{ text: 'Home', href: '/' }, { text: outboxEvents }],
      referenceNumber,
      events,
      eventsJson: events ? events.map((e) => JSON.stringify(e, null, 2)) : null,
      dlqWarning,
      banner: banner(request.query)
    })
  }
}

export const outboxEventsReplayController = {
  async handler(request, h) {
    const referenceNumber = request.payload?.referenceNumber?.trim()
    const traceId = getTraceId() ?? ''

    if (!referenceNumber) {
      return h.redirect(`${OUTBOX_EVENTS_PATH}?error=missing-ref`)
    }

    const authData = request.auth?.isAuthenticated
      ? await request.server.app.cache.get(request.auth.credentials.sessionId)
      : null
    const userId = authData?.crn ?? 'test-user-id'

    try {
      await notificationClient.replay(referenceNumber, traceId, userId)
      return h.redirect(
        `${OUTBOX_EVENTS_PATH}?referenceNumber=${encodeURIComponent(referenceNumber)}&replayed=1`
      )
    } catch (err) {
      request.logger.error({ err }, 'Failed to replay outbox events')
      return h.redirect(
        `${OUTBOX_EVENTS_PATH}?referenceNumber=${encodeURIComponent(referenceNumber)}&error=replay-failed`
      )
    }
  }
}
