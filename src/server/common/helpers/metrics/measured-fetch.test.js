import { Writable } from 'node:stream'
import { pino } from 'pino'
import { ecsFormat } from '@elastic/ecs-pino-format'
import { Metrics } from '@defra/cdp-metrics'
import { vi } from 'vitest'

import { measuredFetch } from './measured-fetch.js'
import { recordEmfDocuments } from '../../test-helpers/emf-documents.js'
import { recordModuleLogger } from '../../test-helpers/module-logger-lines.js'

const REPLAY = { dependency: 'animals-backend', operation: 'replay' }
const URL = 'http://backend/notifications/GBN-AG-26-ABC123/replay'
const OPTIONS = { method: 'POST' }

const encodeWithEcsFormat = (level, { fields, message }) => {
  const lines = []
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(chunk.toString())
      done()
    }
  })
  pino(ecsFormat(), stream)[level](fields, message)
  return JSON.parse(lines[0])
}

describe('#measuredFetch', () => {
  const emf = recordEmfDocuments()
  const infoLines = recordModuleLogger('info')
  const warnLines = recordModuleLogger('warn')
  let originalFetch

  beforeEach(() => {
    originalFetch = global.fetch
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('When the call succeeds', () => {
    test('Should return the response and publish one document with failure 0 under the dependency and operation', async () => {
      const response = { ok: true, status: 200 }
      fetch.mockResolvedValueOnce(response)

      const result = await measuredFetch(REPLAY, URL, OPTIONS)

      expect(result).toBe(response)
      expect(fetch).toHaveBeenCalledWith(URL, OPTIONS)
      await vi.waitFor(() => expect(emf.documents()).toHaveLength(1))
      const [document] = emf.documents()
      const [directive] = document._aws.CloudWatchMetrics
      expect(directive.Namespace).toBe('trade-imports-animals-admin')
      expect(directive.Dimensions).toEqual([['dependency', 'operation']])
      expect(directive.Metrics).toEqual([
        { Name: 'external.call.duration', Unit: 'Milliseconds' },
        { Name: 'external.call.failure', Unit: 'Count' }
      ])
      expect(document).toMatchObject({
        dependency: 'animals-backend',
        operation: 'replay',
        'external.call.failure': 0
      })
      expect(document['external.call.duration']).toBeGreaterThanOrEqual(0)
    })

    test('Should log one info line with the nested event fields and an integral duration in nanoseconds', async () => {
      fetch.mockResolvedValueOnce({ ok: true, status: 200 })

      await measuredFetch(REPLAY, URL, OPTIONS)

      const [line] = infoLines.entries()
      expect(infoLines.entries()).toHaveLength(1)
      expect(line.message).toMatch(
        /^External call animals-backend\/replay success in \d+ ms$/
      )
      expect(line.fields).toEqual({
        event: {
          category: 'external-call',
          action: 'animals-backend/replay',
          outcome: 'success',
          duration: expect.any(Number)
        }
      })
      expect(Number.isInteger(line.fields.event.duration)).toBe(true)
      expect(warnLines.entries()).toEqual([])
    })
  })

  describe('When the response has a status of 400 or over', () => {
    test('Should return the response, publish failure 1 and log one warn line with no error fields', async () => {
      const response = { ok: false, status: 503 }
      fetch.mockResolvedValueOnce(response)

      const result = await measuredFetch(REPLAY, URL, OPTIONS)

      expect(result).toBe(response)
      await vi.waitFor(() => expect(emf.documents()).toHaveLength(1))
      expect(emf.documents()[0]['external.call.failure']).toBe(1)
      const [line] = warnLines.entries()
      expect(warnLines.entries()).toHaveLength(1)
      expect(line.message).toMatch(
        /^External call animals-backend\/replay failure in \d+ ms$/
      )
      expect(line.fields).toEqual({
        event: expect.objectContaining({ outcome: 'failure' })
      })
      expect(infoLines.entries()).toEqual([])
    })
  })

  describe('When fetch throws', () => {
    test('Should rethrow the same error, publish failure 1 and log the error type and message', async () => {
      const cause = new TypeError('fetch failed')
      fetch.mockRejectedValueOnce(cause)

      await expect(measuredFetch(REPLAY, URL, OPTIONS)).rejects.toBe(cause)

      await vi.waitFor(() => expect(emf.documents()).toHaveLength(1))
      expect(emf.documents()[0]['external.call.failure']).toBe(1)
      expect(warnLines.entries()[0].fields).toEqual({
        event: expect.objectContaining({ outcome: 'failure' }),
        'error.type': 'TypeError',
        'error.message': 'fetch failed'
      })
    })

    test('Should encode, in ECS format, a nested event object, flat error fields and no stack trace', async () => {
      fetch.mockRejectedValueOnce(new TypeError('fetch failed'))

      await expect(measuredFetch(REPLAY, URL, OPTIONS)).rejects.toThrow()

      const encoded = encodeWithEcsFormat('warn', warnLines.entries()[0])
      expect(encoded.event).toMatchObject({
        category: 'external-call',
        action: 'animals-backend/replay',
        outcome: 'failure',
        duration: expect.any(Number)
      })
      expect(encoded['error.type']).toBe('TypeError')
      expect(encoded['error.message']).toBe('fetch failed')
      expect(encoded).not.toHaveProperty(['error.stack_trace'])
      expect(encoded).not.toHaveProperty('error')
      expect(encoded).not.toHaveProperty(['event.category'])
    })
  })

  describe('When the metrics document cannot be written', () => {
    test('Should still return the response and log a warning with the error and dimensions', async () => {
      const flushError = new Error('agent unavailable')
      const metricsLogger = {
        setNamespace: vi.fn(),
        putMetric: vi.fn(),
        flush: vi.fn().mockRejectedValue(flushError)
      }
      vi.spyOn(Metrics.prototype, 'getMetricsLogger').mockReturnValue(
        metricsLogger
      )
      const response = { ok: true, status: 200 }
      fetch.mockResolvedValueOnce(response)

      const result = await measuredFetch(REPLAY, URL, OPTIONS)

      expect(result).toBe(response)
      await vi.waitFor(() =>
        expect(warnLines.entriesWith('Could not publish metrics')).toEqual([
          {
            fields: {
              err: flushError,
              dimensions: { dependency: 'animals-backend', operation: 'replay' }
            },
            message: 'Could not publish metrics'
          }
        ])
      )
    })
  })
})
