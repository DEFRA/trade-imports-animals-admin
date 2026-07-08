import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
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

vi.mock('../common/clients/dlq-client.js', () => ({
  dlqClient: {
    list: vi.fn(),
    replayAll: vi.fn(),
    deleteAll: vi.fn()
  }
}))

const REDIRECT = 302

describe('#dlqEventsController', () => {
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

  describe('GET /dlq-events', () => {
    test('Should list the first 25 messages and render the table', async () => {
      dlqClient.list.mockResolvedValue({
        messages: [
          {
            id: 'evt-1',
            message_group_id: 'group-a',
            body: '{"key":"a"}'
          }
        ],
        approximate_count: 5
      })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/dlq-events'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(dlqClient.list).toHaveBeenCalledWith(expect.any(String), {
        limit: 25
      })
      expect(result).toEqual(expect.stringContaining('DLQ process'))
      expect(result).toEqual(expect.stringContaining('evt-1'))
      expect(result).toEqual(expect.stringContaining('group-a'))
      expect(result).toEqual(expect.stringContaining('View JSON'))
      expect(result).toEqual(expect.stringContaining('approximately 5'))
    })

    test('Should render the empty state when there are no messages', async () => {
      dlqClient.list.mockResolvedValue({ messages: [], approximate_count: 0 })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/dlq-events'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(
        expect.stringContaining('no messages on the dead-letter queue')
      )
      expect(result).not.toEqual(expect.stringContaining('govuk-table'))
    })

    test('Should show a success banner after a replay-all redirect', async () => {
      dlqClient.list.mockResolvedValue({ messages: [], approximate_count: 0 })

      const { result } = await server.inject({
        method: 'GET',
        url: '/dlq-events?replayed=1'
      })

      expect(result).toEqual(expect.stringContaining('Replay-all started'))
    })

    test('Should show a success banner after a delete-all redirect', async () => {
      dlqClient.list.mockResolvedValue({ messages: [], approximate_count: 0 })

      const { result } = await server.inject({
        method: 'GET',
        url: '/dlq-events?deleted=1'
      })

      expect(result).toEqual(expect.stringContaining('Delete-all started'))
    })

    test('Should show an error banner after an action-failed redirect', async () => {
      dlqClient.list.mockResolvedValue({ messages: [], approximate_count: 0 })

      const { result } = await server.inject({
        method: 'GET',
        url: '/dlq-events?error=action-failed'
      })

      expect(result).toEqual(
        expect.stringContaining(
          'There was a problem contacting the gateway. Please try again.'
        )
      )
    })

    test('Should render a non-JSON message body as-is', async () => {
      dlqClient.list.mockResolvedValue({
        messages: [
          {
            id: 'evt-1',
            message_group_id: 'group-a',
            body: 'not json'
          }
        ],
        approximate_count: 1
      })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/dlq-events'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(expect.stringContaining('not json'))
    })
  })

  describe('POST /dlq-events', () => {
    test('Should start a replay-all and redirect with a success banner', async () => {
      dlqClient.replayAll.mockResolvedValue()

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/dlq-events',
        payload: { action: 'replay-all' }
      })

      expect(dlqClient.replayAll).toHaveBeenCalledWith(expect.any(String))
      expect(statusCode).toBe(REDIRECT)
      expect(headers.location).toBe('/dlq-events?replayed=1')
    })

    test('Should start a delete-all and redirect with a success banner', async () => {
      dlqClient.deleteAll.mockResolvedValue()

      const { headers } = await server.inject({
        method: 'POST',
        url: '/dlq-events',
        payload: { action: 'delete-all' }
      })

      expect(dlqClient.deleteAll).toHaveBeenCalledWith(expect.any(String))
      expect(headers.location).toBe('/dlq-events?deleted=1')
    })

    test('Should redirect with action-failed when the gateway call throws', async () => {
      dlqClient.replayAll.mockRejectedValue(new Error('gateway down'))

      const { headers } = await server.inject({
        method: 'POST',
        url: '/dlq-events',
        payload: { action: 'replay-all' }
      })

      expect(headers.location).toBe('/dlq-events?error=action-failed')
    })
  })
})
