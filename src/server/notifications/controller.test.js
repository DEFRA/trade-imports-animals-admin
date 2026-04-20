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
    getByRef: vi.fn(),
    streamFile: vi.fn(),
    delete: vi.fn()
  }
}))

describe('#notificationsController', () => {
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

  describe('GET /notifications', () => {
    test('Should render notifications table with reference numbers', async () => {
      notificationClient.getAllReferenceNumbers.mockResolvedValue(['REF-123'])

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/notifications'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(expect.stringContaining('Notifications |'))
      expect(result).toEqual(expect.stringContaining('REF-123'))
      // Checkbox column
      expect(result).toEqual(expect.stringContaining('id="select-all"'))
      expect(result).toEqual(
        expect.stringContaining('class="notification-checkbox"')
      )
      expect(result).toEqual(expect.stringContaining('value="REF-123"'))
      // Delete button (always enabled — no disabled attribute)
      expect(result).toEqual(expect.stringContaining('id="delete-btn"'))
      // Note: scans full rendered HTML. Any use of the string "disabled" anywhere
      // on this page (attribute, class name, aria-disabled, etc.) will break this
      // test. Keep all controls on this page fully enabled.
      expect(result).not.toEqual(expect.stringContaining('disabled'))
      // Inline error element present and hidden by default
      expect(result).toEqual(expect.stringContaining('id="delete-error"'))
      // Dialog
      expect(result).toEqual(expect.stringContaining('id="delete-dialog"'))
      // Banners (hidden)
      expect(result).toEqual(expect.stringContaining('id="success-banner"'))
      expect(result).toEqual(expect.stringContaining('id="error-banner"'))
      // Manual delete section always present
      expect(result).toEqual(
        expect.stringContaining('id="manual-reference-input"')
      )
      expect(result).toEqual(expect.stringContaining('id="manual-delete-btn"'))
    })

    test('Should render empty state when no notifications exist', async () => {
      notificationClient.getAllReferenceNumbers.mockResolvedValue([])

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/notifications'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(
        expect.stringContaining('There are no notifications.')
      )
      // Table elements NOT present in empty state
      expect(result).not.toEqual(expect.stringContaining('id="select-all"'))
      expect(result).not.toEqual(expect.stringContaining('id="delete-btn"'))
      // Manual delete section, dialog and banners ALWAYS present
      expect(result).toEqual(
        expect.stringContaining('id="manual-reference-input"')
      )
      expect(result).toEqual(expect.stringContaining('id="manual-delete-btn"'))
      expect(result).toEqual(expect.stringContaining('id="delete-dialog"'))
      expect(result).toEqual(expect.stringContaining('id="success-banner"'))
      expect(result).toEqual(expect.stringContaining('id="error-banner"'))
    })

    test('Should return 500 when notificationClient.getAllReferenceNumbers throws', async () => {
      notificationClient.getAllReferenceNumbers.mockRejectedValue(
        new Error('Backend error')
      )

      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/notifications'
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
    })
  })

  describe('GET /notifications/{ref}', () => {
    const referenceNumber = 'DRAFT.IMP.2026.abc123'

    const notificationFixture = {
      referenceNumber,
      origin: {
        countryCode: 'GB',
        requiresRegionCode: 'true',
        internalReference: 'REF-001'
      },
      commodity: { name: 'Live bovine animals', commodityComplement: [] },
      reasonForImport: 'PERMANENT',
      additionalDetails: {
        certifiedFor: 'HUMAN_CONSUMPTION',
        unweanedAnimals: 'false'
      },
      cphNumber: null,
      created: '2026-04-20T11:20:06',
      updated: '2026-04-20T11:20:06',
      accompanyingDocuments: [
        {
          uploadId: 'upload-abc-123',
          documentType: 'ITAHC',
          documentReference: 'UK/GB/2026/001',
          dateOfIssue: '2026-01-15T00:00:00Z',
          scanStatus: 'COMPLETE',
          files: [
            {
              fileId: 'file-xyz-456',
              filename: 'health-cert.pdf',
              fileStatus: 'complete'
            }
          ]
        }
      ]
    }

    test('Should render notification details page with all key fields', async () => {
      notificationClient.getByRef.mockResolvedValue(notificationFixture)

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/notifications/${referenceNumber}`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(expect.stringContaining(referenceNumber))
      expect(result).toEqual(expect.stringContaining('GB'))
      expect(result).toEqual(expect.stringContaining('ITAHC'))
      expect(result).toEqual(expect.stringContaining('UK/GB/2026/001'))
      expect(result).toEqual(expect.stringContaining('HUMAN_CONSUMPTION'))
    })

    test('Should render a download link for completed scanned files', async () => {
      notificationClient.getByRef.mockResolvedValue(notificationFixture)

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/notifications/${referenceNumber}`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(
        expect.stringContaining(
          `/notifications/${referenceNumber}/documents/upload-abc-123/files/file-xyz-456`
        )
      )
      expect(result).toEqual(expect.stringContaining('health-cert.pdf'))
    })

    test('Should render empty accompanying documents state when none uploaded', async () => {
      notificationClient.getByRef.mockResolvedValue({
        ...notificationFixture,
        accompanyingDocuments: []
      })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/notifications/${referenceNumber}`
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(result).toEqual(
        expect.stringContaining('No accompanying documents uploaded.')
      )
    })

    test('Should return 500 when notificationClient.getByRef throws', async () => {
      notificationClient.getByRef.mockRejectedValue(new Error('Backend error'))

      const { statusCode } = await server.inject({
        method: 'GET',
        url: `/notifications/${referenceNumber}`
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
    })
  })

  describe('GET /notifications/{ref}/documents/{uploadId}/files/{fileId}', () => {
    test('Should stream file with correct content headers', async () => {
      const fileContent = 'PDF file content'
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(fileContent))
          controller.close()
        }
      })

      notificationClient.streamFile.mockResolvedValue({
        headers: new Headers({
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="health-cert.pdf"'
        }),
        body: stream
      })

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/notifications/DRAFT.IMP.2026.abc123/documents/upload-abc-123/files/file-xyz-456'
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(headers['content-type']).toContain('application/pdf')
      expect(headers['content-disposition']).toBe(
        'attachment; filename="health-cert.pdf"'
      )
      expect(notificationClient.streamFile).toHaveBeenCalledWith(
        'upload-abc-123',
        'file-xyz-456',
        expect.any(String)
      )
    })

    test('Should return 500 when notificationClient.streamFile throws', async () => {
      notificationClient.streamFile.mockRejectedValue(new Error('S3 error'))

      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/notifications/DRAFT.IMP.2026.abc123/documents/upload-abc-123/files/file-xyz-456'
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
    })
  })

  describe('DELETE /notifications', () => {
    test('Should return 204 when delete succeeds', async () => {
      notificationClient.delete.mockResolvedValue(undefined)

      const { statusCode } = await server.inject({
        method: 'DELETE',
        url: '/notifications',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify(['REF-123', 'REF-456'])
      })

      expect(statusCode).toBe(statusCodes.noContent)
      expect(notificationClient.delete).toHaveBeenCalledWith(
        ['REF-123', 'REF-456'],
        'test-trace-id',
        'test-user-id'
      )
    })

    test('Should return 400 when payload is null', async () => {
      const { statusCode } = await server.inject({
        method: 'DELETE',
        url: '/notifications',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify(null)
      })

      expect(statusCode).toBe(statusCodes.badRequest)
    })

    test('Should return 400 when payload is an empty array', async () => {
      const { statusCode } = await server.inject({
        method: 'DELETE',
        url: '/notifications',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify([])
      })

      expect(statusCode).toBe(statusCodes.badRequest)
    })

    test('Should return 400 when payload contains non-string values', async () => {
      const { statusCode } = await server.inject({
        method: 'DELETE',
        url: '/notifications',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify([123, true])
      })

      expect(statusCode).toBe(statusCodes.badRequest)
    })

    test('Should return 500 when notificationClient.delete throws', async () => {
      notificationClient.delete.mockRejectedValue(new Error('Backend error'))

      const { statusCode } = await server.inject({
        method: 'DELETE',
        url: '/notifications',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify(['REF-123'])
      })

      expect(statusCode).toBe(statusCodes.internalServerError)
    })
  })
})
