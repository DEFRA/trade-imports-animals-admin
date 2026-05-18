import { vi } from 'vitest'

import { notificationClient } from './notification-client.js'

const mockLoggerError = vi.fn()

vi.mock('../helpers/logging/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: (...args) => mockLoggerError(...args)
  })
}))

vi.mock('../../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'tradeImportsAnimalsBackendApi.baseUrl') {
        return 'http://mock-backend'
      }

      if (key === 'tracing.header') {
        return 'x-trace-id'
      }

      if (key === 'tradeImportsAnimalsAdminSecret') {
        return 'test-admin-secret'
      }

      return undefined
    })
  }
}))

describe('#notificationClient', () => {
  const traceId = 'trace-123'
  const mockRequest = { session: {} }
  let originalFetch

  beforeEach(() => {
    originalFetch = global.fetch
    global.fetch = vi.fn()
    mockLoggerError.mockClear()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('getAllReferenceNumbers', () => {
    describe('When getAllReferenceNumbers is called successfully', () => {
      test('Should send GET request to /notifications/reference-numbers and return reference number strings', async () => {
        const responseBody = ['REF-123', 'REF-456']

        fetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(responseBody)
        })

        const result = await notificationClient.getAllReferenceNumbers(
          mockRequest,
          traceId
        )

        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledWith(
          'http://mock-backend/notifications/reference-numbers',
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-trace-id': traceId
            }
          }
        )

        expect(result).toEqual(responseBody)
      })
    })

    describe('When getAllReferenceNumbers request fails', () => {
      test('Should throw an error when getAllReferenceNumbers request fails', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })

        await expect(
          notificationClient.getAllReferenceNumbers(mockRequest, traceId)
        ).rejects.toMatchObject({
          message: 'Failed to get all notification reference numbers',
          status: 500,
          statusText: 'Internal Server Error'
        })

        expect(mockLoggerError).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('delete', () => {
    describe('When delete is called successfully', () => {
      test('Should send DELETE request to /notifications with reference numbers', async () => {
        fetch.mockResolvedValueOnce({ ok: true })

        const userId = 'user-abc-123'
        await notificationClient.delete(['REF-123', 'REF-456'], traceId, userId)

        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledWith(
          'http://mock-backend/notifications',
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'x-trace-id': traceId,
              'User-Id': userId,
              'Trade-Imports-Animals-Admin-Secret': 'test-admin-secret'
            },
            body: JSON.stringify(['REF-123', 'REF-456'])
          }
        )
      })
    })

    describe('When userId is not provided', () => {
      test('Should reject with userId is required error', async () => {
        await expect(notificationClient.delete([], traceId)).rejects.toThrow(
          'userId is required to delete notifications'
        )
      })
    })

    describe('When delete request fails', () => {
      test('Should throw an error when delete request fails', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })

        const userId = 'user-abc-123'
        await expect(
          notificationClient.delete(['REF-123'], traceId, userId)
        ).rejects.toMatchObject({
          message: 'Failed to delete notifications',
          status: 500,
          statusText: 'Internal Server Error'
        })

        expect(mockLoggerError).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('getOutboxEvents', () => {
    describe('When getOutboxEvents is called successfully', () => {
      test('Should send GET request to /notifications/{ref}/outbox-events and return events', async () => {
        const referenceNumber = 'DRAFT.IMP.2026.abc123'
        const responseBody = [
          {
            aggregateVersion: 1,
            eventType: 'uk.gov.defra.imports.notification.NotificationSubmitted'
          },
          {
            aggregateVersion: 2,
            eventType: 'uk.gov.defra.imports.notification.NotificationSubmitted'
          }
        ]

        fetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(responseBody)
        })

        const result = await notificationClient.getOutboxEvents(
          referenceNumber,
          traceId
        )

        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledWith(
          `http://mock-backend/notifications/${referenceNumber}/outbox-events`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-trace-id': traceId
            }
          }
        )
        expect(result).toEqual(responseBody)
      })
    })

    describe('When getOutboxEvents request fails', () => {
      test('Should throw an error when getOutboxEvents request fails', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })

        await expect(
          notificationClient.getOutboxEvents('DRAFT.IMP.2026.abc123', traceId)
        ).rejects.toMatchObject({
          message: 'Failed to get outbox events',
          status: 500,
          statusText: 'Internal Server Error'
        })

        expect(mockLoggerError).toHaveBeenCalledTimes(1)
      })
    })
  })
})
