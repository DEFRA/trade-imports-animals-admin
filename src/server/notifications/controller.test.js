import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { notificationClient } from '../common/clients/notification-client.js'

vi.mock('../../config/config.js', async (importOriginal) => {
  const { config } = await importOriginal()
  const originalGet = config.get.bind(config)
  return {
    config: {
      get: (key) => (key === 'auth.enabled' ? false : originalGet(key))
    }
  }
})

vi.mock('../common/clients/notification-client.js', () => ({
  notificationClient: {
    getAllReferenceNumbers: vi.fn(),
    delete: vi.fn()
  }
}))

describe('#notificationsController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /notifications', () => {
    function pageResponse(content, overrides = {}) {
      return {
        content,
        page: 0,
        size: 25,
        numberOfElements: content.length,
        totalElements: content.length,
        totalPages: content.length > 0 ? 1 : 0,
        ...overrides
      }
    }

    test('Should render notifications table with reference numbers', async () => {
      notificationClient.getAllReferenceNumbers.mockResolvedValue(
        pageResponse(['GBN-AG-26-ABC123'])
      )

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/notifications'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(expect.stringContaining('Notifications |'))
      expect(result).toEqual(expect.stringContaining('GBN-AG-26-ABC123'))
      // Checkbox column
      expect(result).toEqual(expect.stringContaining('id="select-all"'))
      expect(result).toEqual(
        expect.stringContaining('class="notification-checkbox"')
      )
      expect(result).toEqual(
        expect.stringContaining('value="GBN-AG-26-ABC123"')
      )
      // Delete button (always enabled — no disabled attribute)
      expect(result).toEqual(expect.stringContaining('id="delete-btn"'))
      // Note: scans full rendered HTML. Any use of the string "disabled" anywhere
      // on this page (attribute, class name, aria-disabled, etc.) will break this
      // test. Keep all controls on this page fully enabled.
      expect(result).not.toEqual(expect.stringContaining('disabled'))
      // Inline error element present and hidden by default
      expect(result).toEqual(expect.stringContaining('id="delete-error"'))
      // Dialog
      expect(result).toEqual(expect.stringContaining('id="delete-dialog"'))
      // Banners (hidden)
      expect(result).toEqual(expect.stringContaining('id="success-banner"'))
      expect(result).toEqual(expect.stringContaining('id="error-banner"'))
      // Manual delete section always present
      expect(result).toEqual(
        expect.stringContaining('id="manual-reference-input"')
      )
      expect(result).toEqual(expect.stringContaining('id="manual-delete-btn"'))
    })

    test('Should render govukPagination when notifications exceed the admin page size of 50', async () => {
      const referenceNumbers = Array.from(
        { length: 50 },
        (_, i) => `GBN-AG-26-${String(i + 1).padStart(6, '0')}`
      )
      notificationClient.getAllReferenceNumbers.mockResolvedValue(
        pageResponse(referenceNumbers, {
          page: 0,
          totalElements: 51,
          totalPages: 2
        })
      )

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/notifications'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(expect.stringContaining('govuk-pagination'))
      expect(result).toEqual(
        expect.stringContaining('href="/notifications?page=2"')
      )
    })

    test('Should request page=0 from backend when no page query param', async () => {
      notificationClient.getAllReferenceNumbers.mockResolvedValue(
        pageResponse([])
      )

      await server.inject({ method: 'GET', url: '/notifications' })

      expect(notificationClient.getAllReferenceNumbers).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        { page: 0 }
      )
    })

    test('Should convert 1-based ?page=3 to 0-based page=2 when calling backend', async () => {
      notificationClient.getAllReferenceNumbers.mockResolvedValue(
        pageResponse(['GBN-AG-26-XYZ'], {
          page: 2,
          totalElements: 60,
          totalPages: 3
        })
      )

      await server.inject({ method: 'GET', url: '/notifications?page=3' })

      expect(notificationClient.getAllReferenceNumbers).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        { page: 2 }
      )
    })

    test('Should clamp non-positive, missing or non-numeric ?page= to backend page=0', async () => {
      notificationClient.getAllReferenceNumbers.mockResolvedValue(
        pageResponse([])
      )

      for (const url of [
        '/notifications?page=0',
        '/notifications?page=-3',
        '/notifications?page=abc',
        '/notifications?page='
      ]) {
        notificationClient.getAllReferenceNumbers.mockClear()
        await server.inject({ method: 'GET', url })
        expect(notificationClient.getAllReferenceNumbers).toHaveBeenCalledWith(
          expect.anything(),
          expect.any(String),
          { page: 0 }
        )
      }
    })

    test('Should render govukPagination with 1-based hrefs when totalPages > 1', async () => {
      notificationClient.getAllReferenceNumbers.mockResolvedValue(
        pageResponse(['GBN-AG-26-ABC123'], {
          page: 1,
          totalElements: 60,
          totalPages: 3
        })
      )

      const { result } = await server.inject({
        method: 'GET',
        url: '/notifications?page=2'
      })

      expect(result).toEqual(expect.stringContaining('govuk-pagination'))
      // Previous link points at /notifications (page 1, no query)
      expect(result).toEqual(expect.stringContaining('href="/notifications"'))
      // Next link is page 3
      expect(result).toEqual(
        expect.stringContaining('href="/notifications?page=3"')
      )
    })

    test('Should NOT render govukPagination when totalPages <= 1', async () => {
      notificationClient.getAllReferenceNumbers.mockResolvedValue(
        pageResponse(['GBN-AG-26-ABC123'])
      )

      const { result } = await server.inject({
        method: 'GET',
        url: '/notifications'
      })

      expect(result).not.toEqual(expect.stringContaining('govuk-pagination'))
    })

    test('Should redirect to /notifications when requested page is out of range', async () => {
      notificationClient.getAllReferenceNumbers.mockResolvedValue(
        pageResponse([], { page: 99, totalElements: 60, totalPages: 3 })
      )

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/notifications?page=100'
      })

      expect(statusCode).toBe(302)
      expect(headers.location).toBe('/notifications')
    })

    test('Should render empty state when no notifications exist', async () => {
      notificationClient.getAllReferenceNumbers.mockResolvedValue(
        pageResponse([])
      )

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/notifications'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(
        expect.stringContaining('There are no notifications.')
      )
      // Table elements NOT present in empty state
      expect(result).not.toEqual(expect.stringContaining('id="select-all"'))
      expect(result).not.toEqual(expect.stringContaining('id="delete-btn"'))
      // Manual delete section, dialog and banners ALWAYS present
      expect(result).toEqual(
        expect.stringContaining('id="manual-reference-input"')
      )
      expect(result).toEqual(expect.stringContaining('id="manual-delete-btn"'))
      expect(result).toEqual(expect.stringContaining('id="delete-dialog"'))
      expect(result).toEqual(expect.stringContaining('id="success-banner"'))
      expect(result).toEqual(expect.stringContaining('id="error-banner"'))
    })

    test('Should return 500 when notificationClient.getAllReferenceNumbers throws', async () => {
      notificationClient.getAllReferenceNumbers.mockRejectedValue(
        new Error('Backend error')
      )

      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/notifications'
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
    })
  })

  describe('DELETE /notifications', () => {
    test('Should return 204 when delete succeeds', async () => {
      notificationClient.delete.mockResolvedValue(undefined)

      const { statusCode } = await server.inject({
        method: 'DELETE',
        url: '/notifications',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify(['GBN-AG-26-ABC123', 'GBN-AG-26-DEF456'])
      })

      expect(statusCode).toBe(statusCodes.noContent)
      expect(notificationClient.delete).toHaveBeenCalledWith(
        ['GBN-AG-26-ABC123', 'GBN-AG-26-DEF456'],
        'test-trace-id',
        'test-user-id'
      )
    })

    test('Should return 400 when payload is null', async () => {
      const { statusCode } = await server.inject({
        method: 'DELETE',
        url: '/notifications',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify(null)
      })

      expect(statusCode).toBe(statusCodes.badRequest)
    })

    test('Should return 400 when payload is an empty array', async () => {
      const { statusCode } = await server.inject({
        method: 'DELETE',
        url: '/notifications',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify([])
      })

      expect(statusCode).toBe(statusCodes.badRequest)
    })

    test('Should return 400 when payload contains non-string values', async () => {
      const { statusCode } = await server.inject({
        method: 'DELETE',
        url: '/notifications',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify([123, true])
      })

      expect(statusCode).toBe(statusCodes.badRequest)
    })

    test('Should return 500 when notificationClient.delete throws', async () => {
      notificationClient.delete.mockRejectedValue(new Error('Backend error'))

      const { statusCode } = await server.inject({
        method: 'DELETE',
        url: '/notifications',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify(['GBN-AG-26-ABC123'])
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
    })
  })
})
