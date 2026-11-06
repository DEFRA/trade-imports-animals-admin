import { vi } from 'vitest'
import { useAuthEnabledServer } from '../common/test-helpers/use-auth-enabled-server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { mockOidcConfig } from '../common/test-helpers/mock-oidc-config.js'
import { verifyToken } from '../../auth/verify-token.js'

vi.mock('../../auth/get-oidc-config.js', () => ({
  getOidcConfig: vi.fn(() => Promise.resolve(mockOidcConfig))
}))

vi.mock('../../auth/verify-token.js', () => ({
  verifyToken: vi.fn()
}))

const defraIdAuth = () => ({
  strategy: 'defra-id',
  credentials: {
    profile: {
      sessionId: 'signin-oidc-session',
      crn: 'CRN123',
      organisationId: 'org-1'
    },
    token: 'mock-token',
    refreshToken: 'mock-refresh-token'
  }
})

describe('#authController', () => {
  const running = useAuthEnabledServer()

  test('GET /auth/sign-in-oidc renders unauthorised when token verification fails', async () => {
    verifyToken.mockRejectedValue(new Error('Client request timeout'))

    const { statusCode, payload, headers } = await running.server.inject({
      method: 'GET',
      url: '/auth/sign-in-oidc',
      auth: defraIdAuth()
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(payload).toContain('Sorry, we are unable to sign you in')
    expect(headers['set-cookie'] ?? []).not.toContainEqual(
      expect.stringContaining('sid=')
    )
  })
})
