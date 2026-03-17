import { getTraceId } from '@defra/hapi-tracing'
import { notificationClient } from '../common/clients/notification-client.js'

export const notificationsController = {
  async handler(request, h) {
    const traceId = getTraceId()
    const notifications = await notificationClient.getAll(request, traceId)

    return h.view('notifications/index', {
      pageTitle: 'Notifications',
      heading: 'Notifications',
      breadcrumbs: [{ text: 'Home', href: '/' }, { text: 'Notifications' }],
      notifications
    })
  }
}
