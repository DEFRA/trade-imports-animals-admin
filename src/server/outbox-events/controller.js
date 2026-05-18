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

    return h.view('outbox-events/index', {
      pageTitle: 'Outbox events',
      heading: 'Outbox events',
      breadcrumbs: [{ text: 'Home', href: '/' }, { text: 'Outbox events' }],
      referenceNumber,
      events,
      eventsJson: events ? events.map((e) => JSON.stringify(e, null, 2)) : null
    })
  }
}
