import { vi } from 'vitest'

import { notificationClient } from './notification-client.js'

const mockLoggerError = vi.fn()
const mockGetSessionValue = vi.fn()
const mockSetSessionValue = vi.fn()

vi.mock('../helpers/logging/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: (...args) => mockLoggerError(...args)
  })
}))

vi.mock('../helpers/session-helpers.js', () => ({
  getSessionValue: (...args) => mockGetSessionValue(...args),
  setSessionValue: (...args) => mockSetSessionValue(...args)
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
    mockGetSessionValue.mockClear()
    mockSetSessionValue.mockClear()
    mockLoggerError.mockClear()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('getAll', () => {
    describe('When getAll is called successfully', () => {
      test('Should send GET request to /notifications and return all notifications', async () => {
        const responseBody = [
          {
            referenceNumber: 'REF-123',
            origin: { countryCode: 'GB' },
            commodity: 'Fish'
          },
          {
            referenceNumber: 'REF-456',
            origin: { countryCode: 'FR' },
            commodity: 'Cat'
          }
        ]

        fetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(responseBody)
        })

        const result = await notificationClient.getAll(mockRequest, traceId)

        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledWith(
          'http://mock-backend/notifications',
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

    describe('When getAll request fails', () => {
      test('Should throw an error when getAll request fails', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: vi.fn().mockResolvedValue({ message: 'Server error' })
        })

        await expect(
          notificationClient.getAll(mockRequest, traceId)
        ).rejects.toMatchObject({
          message: 'Failed to get all notifications',
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

        await notificationClient.delete(['REF-123', 'REF-456'], traceId)

        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledWith(
          'http://mock-backend/notifications',
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'x-trace-id': traceId,
              'Trade-Imports-Animals-Admin-Secret': 'test-admin-secret'
            },
            body: JSON.stringify(['REF-123', 'REF-456'])
          }
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

        await expect(
          notificationClient.delete(['REF-123'], traceId)
        ).rejects.toMatchObject({
          message: 'Failed to delete notifications',
          status: 500,
          statusText: 'Internal Server Error'
        })

        expect(mockLoggerError).toHaveBeenCalledTimes(1)
      })
    })
  })
})
