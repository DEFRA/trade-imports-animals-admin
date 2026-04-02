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
    getAll: vi.fn(),
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
    test('Should render notifications table with reference numbers', async () => {
      notificationClient.getAll.mockResolvedValue([
        { referenceNumber: 'REF-123' }
      ])

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/notifications'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(expect.stringContaining('Notifications |'))
      expect(result).toEqual(expect.stringContaining('REF-123'))
      // Checkbox column
      expect(result).toEqual(expect.stringContaining('id="select-all"'))
      expect(result).toEqual(
        expect.stringContaining('class="notification-checkbox"')
      )
      expect(result).toEqual(expect.stringContaining('value="REF-123"'))
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

    test('Should render empty state when no notifications exist', async () => {
      notificationClient.getAll.mockResolvedValue([])

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

    test('Should return 500 when notificationClient.getAll throws', async () => {
      notificationClient.getAll.mockRejectedValue(new Error('Backend error'))

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
        payload: JSON.stringify(['REF-123', 'REF-456'])
      })

      expect(statusCode).toBe(statusCodes.noContent)
      expect(notificationClient.delete).toHaveBeenCalledWith(
        ['REF-123', 'REF-456'],
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
        payload: JSON.stringify(['REF-123'])
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
    })
  })
})
