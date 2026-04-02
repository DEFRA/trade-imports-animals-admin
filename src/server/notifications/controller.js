import { getTraceId } from '@defra/hapi-tracing'
import { notificationClient } from '../common/clients/notification-client.js'

export const notificationsController = {
  async handler(request, h) {
    const traceId = getTraceId() ?? ''
    const notifications = await notificationClient.getAll(request, traceId)

    return h.view('notifications/index', {
      pageTitle: 'Notifications',
      heading: 'Notifications',
      breadcrumbs: [{ text: 'Home', href: '/' }, { text: 'Notifications' }],
      notifications
    })
  }
}

export const deleteNotificationsController = {
  options: {
    payload: {
      parse: true,
      allow: 'application/json'
    }
  },
  async handler(request, h) {
    const referenceNumbers = request.payload

    if (
      !Array.isArray(referenceNumbers) ||
      referenceNumbers.length === 0 ||
      !referenceNumbers.every((r) => typeof r === 'string')
    ) {
      return h.response({ message: 'Invalid payload' }).code(400)
    }

    const traceId = getTraceId() ?? 'test-trace-id'
    const authData = request.auth?.isAuthenticated
      ? await request.server.app.cache.get(request.auth.credentials.sessionId)
      : null

    const userId = authData?.crn ?? 'test-user-id'
    await notificationClient.delete(referenceNumbers, traceId, userId)
    return h.response().code(204)
  }
}
