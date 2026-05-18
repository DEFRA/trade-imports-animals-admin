import { getTraceId } from '@defra/hapi-tracing'
import { notificationClient } from '../common/clients/notification-client.js'

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

    const outboxEvents = 'Outbox events'
    return h.view('outbox-events/index', {
      pageTitle: outboxEvents,
      heading: outboxEvents,
      breadcrumbs: [{ text: 'Home', href: '/' }, { text: outboxEvents }],
      referenceNumber,
      events,
      eventsJson: events ? events.map((e) => JSON.stringify(e, null, 2)) : null
    })
  }
}
