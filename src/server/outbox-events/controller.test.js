import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { notificationClient } from '../common/clients/notification-client.js'
import { dlqClient } from '../common/clients/dlq-client.js'

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
    getOutboxEvents: vi.fn(),
    replay: vi.fn()
  }
}))

vi.mock('../common/clients/dlq-client.js', () => ({
  dlqClient: {
    list: vi.fn(),
    replayAll: vi.fn(),
    deleteAll: vi.fn()
  }
}))

const REDIRECT = 302

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
      expect(dlqClient.list).not.toHaveBeenCalled()
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
      dlqClient.list.mockResolvedValue({ messages: [], approximate_count: 0 })

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

    test('Should show Replay button when events exist', async () => {
      const referenceNumber = 'GBN-AG-26-ABC123'
      notificationClient.getOutboxEvents.mockResolvedValue([
        {
          aggregateVersion: 1,
          eventType: 'SomeType',
          timestamp: '2026-07-13T10:00:00Z'
        }
      ])
      dlqClient.list.mockResolvedValue({ messages: [], approximate_count: 0 })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/outbox-events?referenceNumber=${referenceNumber}`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(expect.stringContaining('Replay all events'))
      expect(result).toEqual(
        expect.stringContaining(
          `name="referenceNumber" value="${referenceNumber}"`
        )
      )
    })

    test('Should show DLQ warning banner when DLQ is non-empty', async () => {
      const referenceNumber = 'GBN-AG-26-ABC123'
      notificationClient.getOutboxEvents.mockResolvedValue([
        {
          aggregateVersion: 1,
          eventType: 'SomeType',
          timestamp: '2026-07-13T10:00:00Z'
        }
      ])
      dlqClient.list.mockResolvedValue({ messages: [], approximate_count: 3 })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/outbox-events?referenceNumber=${referenceNumber}`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(
        expect.stringContaining('approximately 3 message(s)')
      )
      expect(result).toEqual(expect.stringContaining('Replay all events'))
    })

    test('Should not show DLQ warning banner when DLQ is empty', async () => {
      const referenceNumber = 'GBN-AG-26-ABC123'
      notificationClient.getOutboxEvents.mockResolvedValue([
        {
          aggregateVersion: 1,
          eventType: 'SomeType',
          timestamp: '2026-07-13T10:00:00Z'
        }
      ])
      dlqClient.list.mockResolvedValue({ messages: [], approximate_count: 0 })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/outbox-events?referenceNumber=${referenceNumber}`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).not.toEqual(
        expect.stringContaining('Consider clearing or redriving')
      )
    })

    test('Should still render events when DLQ check fails', async () => {
      const referenceNumber = 'GBN-AG-26-ABC123'
      notificationClient.getOutboxEvents.mockResolvedValue([
        {
          aggregateVersion: 1,
          eventType: 'SomeType',
          timestamp: '2026-07-13T10:00:00Z'
        }
      ])
      dlqClient.list.mockRejectedValue(new Error('gateway down'))

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/outbox-events?referenceNumber=${referenceNumber}`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(expect.stringContaining('govuk-table'))
      expect(result).toEqual(expect.stringContaining('Replay all events'))
    })

    test('Should not check DLQ when no events exist for reference number', async () => {
      const referenceNumber = 'GBN-AG-26-ABSENT'
      notificationClient.getOutboxEvents.mockResolvedValue([])

      await server.inject({
        method: 'GET',
        url: `/outbox-events?referenceNumber=${referenceNumber}`
      })

      expect(dlqClient.list).not.toHaveBeenCalled()
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
      expect(result).toEqual(expect.stringContaining(referenceNumber))
      expect(result).not.toEqual(expect.stringContaining('govuk-table'))
    })

    test('Should return 500 when getOutboxEvents throws', async () => {
      notificationClient.getOutboxEvents.mockRejectedValue(
        new Error('Backend error')
      )

      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/outbox-events?referenceNumber=DRAFT.IMP.2026.abc123'
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
    })

    test('Should show success banner after a successful replay', async () => {
      const referenceNumber = 'GBN-AG-26-ABC123'
      notificationClient.getOutboxEvents.mockResolvedValue([
        {
          aggregateVersion: 1,
          eventType: 'SomeType',
          timestamp: '2026-07-13T10:00:00Z'
        }
      ])
      dlqClient.list.mockResolvedValue({ messages: [], approximate_count: 0 })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/outbox-events?referenceNumber=${referenceNumber}&replayed=1`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(
        expect.stringContaining('All outbox events have been re-published')
      )
    })

    test('Should show error banner when replay failed', async () => {
      const referenceNumber = 'GBN-AG-26-ABC123'
      notificationClient.getOutboxEvents.mockResolvedValue([
        {
          aggregateVersion: 1,
          eventType: 'SomeType',
          timestamp: '2026-07-13T10:00:00Z'
        }
      ])
      dlqClient.list.mockResolvedValue({ messages: [], approximate_count: 0 })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/outbox-events?referenceNumber=${referenceNumber}&error=replay-failed`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(
        expect.stringContaining('There was a problem replaying the events')
      )
    })
  })

  describe('POST /outbox-events/replay', () => {
    test('Should redirect to outbox-events page with replayed=1 on success', async () => {
      const referenceNumber = 'GBN-AG-26-ABC123'
      notificationClient.replay.mockResolvedValue({ eventsReplayed: 2 })

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/outbox-events/replay',
        payload: `referenceNumber=${encodeURIComponent(referenceNumber)}`,
        headers: { 'content-type': 'application/x-www-form-urlencoded' }
      })

      expect(statusCode).toBe(REDIRECT)
      expect(headers.location).toContain('referenceNumber=')
      expect(headers.location).toContain('replayed=1')
    })

    test('Should redirect with error=replay-failed when replay throws', async () => {
      const referenceNumber = 'GBN-AG-26-ABC123'
      notificationClient.replay.mockRejectedValue(
        Object.assign(new Error('Backend error'), { status: 500 })
      )

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/outbox-events/replay',
        payload: `referenceNumber=${encodeURIComponent(referenceNumber)}`,
        headers: { 'content-type': 'application/x-www-form-urlencoded' }
      })

      expect(statusCode).toBe(REDIRECT)
      expect(headers.location).toContain('error=replay-failed')
    })

    test('Should redirect with error=missing-ref when referenceNumber is absent', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/outbox-events/replay',
        payload: '',
        headers: { 'content-type': 'application/x-www-form-urlencoded' }
      })

      expect(statusCode).toBe(REDIRECT)
      expect(headers.location).toContain('error=missing-ref')
      expect(notificationClient.replay).not.toHaveBeenCalled()
    })
  })
})
