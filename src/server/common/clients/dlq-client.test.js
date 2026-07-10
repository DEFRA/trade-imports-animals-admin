import { vi } from 'vitest'

import { dlqClient } from './dlq-client.js'

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
      if (key === 'dynamicsGatewayApi.baseUrl') return 'http://mock-gateway'
      if (key === 'tracing.header') return 'x-trace-id'
      if (key === 'tradeImportsAnimalsAdminSecret') return 'test-admin-secret'
      return undefined
    })
  }
}))

describe('#dlqClient', () => {
  const traceId = 'trace-123'
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

  describe('list', () => {
    test('Should GET the DLQ with the default limit and no admin secret', async () => {
      const body = { messages: [{ id: 'id-1' }], approximate_count: 1 }
      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(body)
      })

      const result = await dlqClient.list(traceId)

      expect(fetch).toHaveBeenCalledWith(
        'http://mock-gateway/dlq/notifications?limit=10',
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'x-trace-id': traceId }
        }
      )
      expect(result).toEqual(body)
    })

    test('Should pass a custom limit', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({})
      })

      await dlqClient.list(traceId, { limit: 5 })

      expect(fetch).toHaveBeenCalledWith(
        'http://mock-gateway/dlq/notifications?limit=5',
        expect.anything()
      )
    })

    test('Should throw when the list request fails', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      await expect(dlqClient.list(traceId)).rejects.toMatchObject({
        message: 'Failed to list DLQ messages',
        status: 500
      })
      expect(mockLoggerError).toHaveBeenCalledTimes(1)
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to list DLQ messages: 500 Internal Server Error'
        )
      )
    })
  })

  describe('replayAll', () => {
    test('Should POST to /replay-all with the admin secret and no body', async () => {
      fetch.mockResolvedValueOnce({ ok: true })

      await dlqClient.replayAll(traceId)

      expect(fetch).toHaveBeenCalledWith(
        'http://mock-gateway/dlq/notifications/replay-all',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-trace-id': traceId,
            'Trade-Imports-Animals-Admin-Secret': 'test-admin-secret'
          }
        }
      )
    })

    test('Should throw when replay-all fails', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      })

      await expect(dlqClient.replayAll(traceId)).rejects.toMatchObject({
        message: 'Failed to start DLQ replay-all',
        status: 401
      })
      expect(mockLoggerError).toHaveBeenCalledTimes(1)
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to start DLQ replay-all: 401 Unauthorized'
        )
      )
    })
  })

  describe('deleteAll', () => {
    test('Should POST to /delete-all with the admin secret and no body', async () => {
      fetch.mockResolvedValueOnce({ ok: true })

      await dlqClient.deleteAll(traceId)

      expect(fetch).toHaveBeenCalledWith(
        'http://mock-gateway/dlq/notifications/delete-all',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-trace-id': traceId,
            'Trade-Imports-Animals-Admin-Secret': 'test-admin-secret'
          }
        }
      )
    })

    test('Should throw when delete-all fails', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      await expect(dlqClient.deleteAll(traceId)).rejects.toMatchObject({
        message: 'Failed to start DLQ delete-all',
        status: 500
      })
      expect(mockLoggerError).toHaveBeenCalledTimes(1)
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to start DLQ delete-all: 500 Internal Server Error'
        )
      )
    })
  })
})
