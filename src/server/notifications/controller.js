import { getTraceId } from '@defra/hapi-tracing'
import { notificationClient } from '../common/clients/notification-client.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { buildPagination } from '../common/helpers/notifications-pagination.js'

const NOTIFICATIONS_PATH = '/notifications'

function parseRequestedPageOneBased(query) {
  const parsed = Number.parseInt(query.page, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export const notificationsController = {
  async handler(request, h) {
    const traceId = getTraceId() ?? ''
    const requestedPageOneBased = parseRequestedPageOneBased(request.query)
    const pageZeroBased = requestedPageOneBased - 1

    const response = await notificationClient.getAllReferenceNumbers(
      request,
      traceId,
      { page: pageZeroBased }
    )

    const referenceNumbers = response?.content ?? []
    const totalElements = response?.totalElements ?? 0
    const totalPages = response?.totalPages ?? 0

    // Out-of-range page when results exist — redirect to page 1 per AC.
    if (totalElements > 0 && referenceNumbers.length === 0) {
      return h.redirect(NOTIFICATIONS_PATH)
    }

    const currentPageOneBased = (response?.page ?? 0) + 1

    return h.view('notifications/index', {
      pageTitle: 'Notifications',
      heading: 'Notifications',
      breadcrumbs: [{ text: 'Home', href: '/' }, { text: 'Notifications' }],
      referenceNumbers,
      totalElements,
      currentPage: currentPageOneBased,
      pagination: buildPagination(
        { page: response?.page ?? 0, totalPages },
        NOTIFICATIONS_PATH
      )
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
    return h.response().code(statusCodes.noContent)
  }
}
