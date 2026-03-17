import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { notificationClient } from '../common/clients/notification-client.js'

vi.mock('../common/clients/notification-client.js', () => ({
  notificationClient: {
    getAll: vi.fn()
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
})
