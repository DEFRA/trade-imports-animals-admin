import { Readable } from 'node:stream'
import Boom from '@hapi/boom'
import Joi from 'joi'
import { getTraceId } from '@defra/hapi-tracing'
import { notificationClient } from '../common/clients/notification-client.js'
import { statusCodes } from '../common/constants/status-codes.js'

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

    let notification
    try {
      notification = await notificationClient.getByRef(ref, traceId)
    } catch (err) {
      if (err.status === statusCodes.notFound) {
        throw Boom.notFound(`Notification ${ref} not found`)
      }
      throw err
    }

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

const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.ms-excel',
  'application/msword',
  'application/octet-stream'
])

export const downloadDocumentController = {
  options: {
    validate: {
      params: Joi.object({
        ref: Joi.string(),
        uploadId: Joi.string().pattern(/^[a-zA-Z0-9-]+$/)
      })
    }
  },
  async handler(request, h) {
    const traceId = getTraceId() ?? ''
    const { uploadId } = request.params

    const backendResponse = await notificationClient.streamFile(
      uploadId,
      traceId
    )

    const rawContentType =
      backendResponse.headers.get('content-type') ?? 'application/octet-stream'
    const mimeType = rawContentType.split(';')[0].trim().toLowerCase()
    const contentType = ALLOWED_CONTENT_TYPES.has(mimeType)
      ? mimeType
      : 'application/octet-stream'

    const contentDisposition =
      backendResponse.headers.get('content-disposition') ?? 'attachment'

    const nodeStream = Readable.fromWeb(backendResponse.body)

    return h
      .response(nodeStream)
      .header('Content-Type', contentType)
      .header('Content-Disposition', contentDisposition)
      .header('X-Content-Type-Options', 'nosniff')
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
      !referenceNumbers.every(
        (referenceNumber) => typeof referenceNumber === 'string'
      )
    ) {
      return h
        .response({ message: 'Invalid payload' })
        .code(statusCodes.badRequest)
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
