import { Readable } from 'node:stream'
import { getTraceId } from '@defra/hapi-tracing'
import { notificationClient } from '../common/clients/notification-client.js'

export const notificationsController = {
  async handler(request, h) {
    const traceId = getTraceId() ?? ''
    const referenceNumbers = await notificationClient.getAllReferenceNumbers(
      request,
      traceId
    )

    return h.view('notifications/index', {
      pageTitle: 'Notifications',
      heading: 'Notifications',
      breadcrumbs: [{ text: 'Home', href: '/' }, { text: 'Notifications' }],
      referenceNumbers
    })
  }
}

export const viewNotificationController = {
  async handler(request, h) {
    const traceId = getTraceId() ?? ''
    const { ref } = request.params
    const notification = await notificationClient.getByRef(ref, traceId)

    return h.view('notifications/view', {
      pageTitle: `Notification ${notification.referenceNumber}`,
      heading: notification.referenceNumber,
      breadcrumbs: [
        { text: 'Home', href: '/' },
        { text: 'Notifications', href: '/notifications' },
        { text: notification.referenceNumber }
      ],
      notification
    })
  }
}

export const downloadDocumentController = {
  async handler(request, h) {
    const traceId = getTraceId() ?? ''
    const { uploadId } = request.params

    const backendResponse = await notificationClient.streamFile(
      uploadId,
      traceId
    )

    const contentType =
      backendResponse.headers.get('content-type') ?? 'application/octet-stream'
    const contentDisposition =
      backendResponse.headers.get('content-disposition') ?? 'attachment'

    const nodeStream = Readable.fromWeb(backendResponse.body)

    return h
      .response(nodeStream)
      .header('Content-Type', contentType)
      .header('Content-Disposition', contentDisposition)
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
