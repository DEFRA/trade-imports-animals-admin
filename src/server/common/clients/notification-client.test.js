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

  describe('getByRef', () => {
    describe('When getByRef is called successfully', () => {
      test('Should send GET request to /notifications/{ref} and return parsed notification', async () => {
        const notification = {
          referenceNumber: 'DRAFT.IMP.2026.abc123',
          origin: { countryCode: 'GB' },
          accompanyingDocuments: []
        }

        fetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(notification)
        })

        const result = await notificationClient.getByRef(
          'DRAFT.IMP.2026.abc123',
          traceId
        )

        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledWith(
          'http://mock-backend/notifications/DRAFT.IMP.2026.abc123',
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-trace-id': traceId
            }
          }
        )
        expect(result).toEqual(notification)
      })
    })

    describe('When getByRef request fails', () => {
      test('Should throw an error with status when request fails', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        })

        await expect(
          notificationClient.getByRef('DRAFT.IMP.2026.MISSING', traceId)
        ).rejects.toMatchObject({
          message: 'Failed to get notification DRAFT.IMP.2026.MISSING',
          status: 404,
          statusText: 'Not Found'
        })

        expect(mockLoggerError).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('streamFile', () => {
    describe('When streamFile is called successfully', () => {
      test('Should send GET request to /document-uploads/{uploadId}/files/{fileId} and return raw response', async () => {
        const mockResponse = {
          ok: true,
          headers: new Headers({ 'content-type': 'application/pdf' }),
          body: new ReadableStream()
        }

        fetch.mockResolvedValueOnce(mockResponse)

        const result = await notificationClient.streamFile(
          'upload-abc-123',
          'file-xyz-456',
          traceId
        )

        expect(fetch).toHaveBeenCalledTimes(1)
        expect(fetch).toHaveBeenCalledWith(
          'http://mock-backend/document-uploads/upload-abc-123/files/file-xyz-456',
          {
            method: 'GET',
            headers: { 'x-trace-id': traceId }
          }
        )
        expect(result).toBe(mockResponse)
      })
    })

    describe('When streamFile request fails', () => {
      test('Should throw an error with status when request fails', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        })

        await expect(
          notificationClient.streamFile(
            'upload-abc-123',
            'file-xyz-456',
            traceId
          )
        ).rejects.toMatchObject({
          message:
            'Failed to stream file file-xyz-456 from upload upload-abc-123',
          status: 404,
          statusText: 'Not Found'
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
