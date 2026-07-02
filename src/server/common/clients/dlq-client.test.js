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
    })
  })

  describe('replay', () => {
    test('Should POST the ids to /replay with the admin secret', async () => {
      fetch.mockResolvedValueOnce({ ok: true })

      await dlqClient.replay(['id-1', 'id-2'], traceId)

      expect(fetch).toHaveBeenCalledWith(
        'http://mock-gateway/dlq/notifications/replay',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-trace-id': traceId,
            'Trade-Imports-Animals-Admin-Secret': 'test-admin-secret'
          },
          body: JSON.stringify({ ids: ['id-1', 'id-2'] })
        }
      )
    })

    test('Should throw when replay fails', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      })

      await expect(dlqClient.replay(['id-1'], traceId)).rejects.toMatchObject({
        message: 'Failed to replay DLQ messages',
        status: 401
      })
      expect(mockLoggerError).toHaveBeenCalledTimes(1)
    })
  })

  describe('deleteEvents', () => {
    test('Should DELETE the ids with the admin secret', async () => {
      fetch.mockResolvedValueOnce({ ok: true })

      await dlqClient.deleteEvents(['id-1'], traceId)

      expect(fetch).toHaveBeenCalledWith(
        'http://mock-gateway/dlq/notifications',
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-trace-id': traceId,
            'Trade-Imports-Animals-Admin-Secret': 'test-admin-secret'
          },
          body: JSON.stringify({ ids: ['id-1'] })
        }
      )
    })

    test('Should throw when delete fails', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      await expect(
        dlqClient.deleteEvents(['id-1'], traceId)
      ).rejects.toMatchObject({
        message: 'Failed to delete DLQ messages',
        status: 500
      })
      expect(mockLoggerError).toHaveBeenCalledTimes(1)
    })
  })
})
