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
    replay: vi.fn(),
    deleteEvents: vi.fn()
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
    test('Should list the first 10 messages and render the table', async () => {
      dlqClient.list.mockResolvedValue({
        messages: [
          {
            id: 'evt-1',
            message_group_id: 'group-a',
            approximate_receive_count: 3,
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
        limit: 10
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

    test('Should show a success banner after a replay redirect', async () => {
      dlqClient.list.mockResolvedValue({ messages: [], approximate_count: 0 })

      const { result } = await server.inject({
        method: 'GET',
        url: '/dlq-events?replayed=2'
      })

      expect(result).toEqual(expect.stringContaining('Replayed 2 message(s).'))
    })

    test('Should show a success banner after a delete redirect', async () => {
      dlqClient.list.mockResolvedValue({ messages: [], approximate_count: 0 })

      const { result } = await server.inject({
        method: 'GET',
        url: '/dlq-events?deleted=1'
      })

      expect(result).toEqual(expect.stringContaining('Deleted 1 message(s).'))
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
            approximate_receive_count: 1,
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

    test('Should show an error banner when nothing was selected', async () => {
      dlqClient.list.mockResolvedValue({ messages: [], approximate_count: 0 })

      const { result } = await server.inject({
        method: 'GET',
        url: '/dlq-events?error=none-selected'
      })

      expect(result).toEqual(
        expect.stringContaining('Select at least one message.')
      )
    })
  })

  describe('POST /dlq-events', () => {
    test('Should replay the selected ids and redirect with a count', async () => {
      dlqClient.replay.mockResolvedValue()

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/dlq-events',
        payload: { ids: ['evt-1', 'evt-2'], action: 'replay' }
      })

      expect(dlqClient.replay).toHaveBeenCalledWith(
        ['evt-1', 'evt-2'],
        expect.any(String)
      )
      expect(statusCode).toBe(REDIRECT)
      expect(headers.location).toBe('/dlq-events?replayed=2')
    })

    test('Should delete a single selected id and redirect with a count', async () => {
      dlqClient.deleteEvents.mockResolvedValue()

      const { headers } = await server.inject({
        method: 'POST',
        url: '/dlq-events',
        payload: { ids: 'evt-1', action: 'delete' }
      })

      expect(dlqClient.deleteEvents).toHaveBeenCalledWith(
        ['evt-1'],
        expect.any(String)
      )
      expect(headers.location).toBe('/dlq-events?deleted=1')
    })

    test('Should redirect with an error when nothing is selected', async () => {
      const { headers } = await server.inject({
        method: 'POST',
        url: '/dlq-events',
        payload: { action: 'replay' }
      })

      expect(headers.location).toBe('/dlq-events?error=none-selected')
      expect(dlqClient.replay).not.toHaveBeenCalled()
    })

    test('Should redirect with action-failed when the gateway call throws', async () => {
      dlqClient.replay.mockRejectedValue(new Error('gateway down'))

      const { headers } = await server.inject({
        method: 'POST',
        url: '/dlq-events',
        payload: { ids: ['evt-1'], action: 'replay' }
      })

      expect(headers.location).toBe('/dlq-events?error=action-failed')
    })
  })
})
