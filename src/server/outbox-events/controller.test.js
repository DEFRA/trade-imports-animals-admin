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
    delete: vi.fn(),
    getOutboxEvents: vi.fn()
  }
}))

describe('#outboxEventsController', () => {
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

  describe('GET /outbox-events', () => {
    test('Should render search form without results when no referenceNumber query param', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/outbox-events'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(expect.stringContaining('Outbox events |'))
      expect(result).toEqual(expect.stringContaining('id="referenceNumber"'))
      expect(result).not.toEqual(expect.stringContaining('govuk-table'))
      expect(notificationClient.getOutboxEvents).not.toHaveBeenCalled()
    })

    test('Should render events table when referenceNumber is provided and events exist', async () => {
      const referenceNumber = 'DRAFT.IMP.2026.abc123'
      const events = [
        {
          aggregateVersion: 1,
          eventType: 'uk.gov.defra.imports.notification.NotificationSubmitted',
          timestamp: '2026-05-18T10:00:00Z',
          data: { referenceNumber }
        },
        {
          aggregateVersion: 2,
          eventType: 'uk.gov.defra.imports.notification.NotificationSubmitted',
          timestamp: '2026-05-18T11:00:00Z',
          data: { referenceNumber }
        }
      ]
      notificationClient.getOutboxEvents.mockResolvedValue(events)

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/outbox-events?referenceNumber=${referenceNumber}`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(expect.stringContaining('govuk-table'))
      expect(result).toEqual(
        expect.stringContaining(
          'uk.gov.defra.imports.notification.NotificationSubmitted'
        )
      )
      expect(result).toEqual(expect.stringContaining('View JSON'))
      expect(notificationClient.getOutboxEvents).toHaveBeenCalledWith(
        referenceNumber,
        expect.any(String)
      )
    })

    test('Should render empty state when referenceNumber is provided but no events exist', async () => {
      const referenceNumber = 'DRAFT.IMP.2026.unknown'
      notificationClient.getOutboxEvents.mockResolvedValue([])

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/outbox-events?referenceNumber=${referenceNumber}`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(
        expect.stringContaining(`No outbox events found for`)
      )
      expect(result).toEqual(
        expect.stringContaining(referenceNumber)
      )
      expect(result).not.toEqual(expect.stringContaining('govuk-table'))
    })
  })
})
