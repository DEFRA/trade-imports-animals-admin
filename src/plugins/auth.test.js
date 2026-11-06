import hapi from '@hapi/hapi'
import hapiBell from '@hapi/bell'
import hapiCookie from '@hapi/cookie'
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { authPlugin, getBellOptions, getCookieOptions } from './auth.js'
import { config } from '../config/config.js'
import { createLogger } from '../server/common/helpers/logging/logger.js'
import { restoreConfigAfterEach } from '../server/common/test-helpers/restore-config-after-each.js'

const wreckGetMock = vi.hoisted(() => vi.fn())
const wreckPostMock = vi.hoisted(() => vi.fn())
const jwtDecodeMock = vi.hoisted(() => vi.fn())
const jwtVerifyTimeMock = vi.hoisted(() => vi.fn())

vi.mock('@hapi/wreck', () => ({
  default: { get: wreckGetMock, post: wreckPostMock }
}))

vi.mock('@hapi/jwt', () => ({
  default: {
    token: {
      decode: jwtDecodeMock,
      verifyTime: jwtVerifyTimeMock
    }
  }
}))

const SIGN_IN_REDIRECT_URL = 'http://localhost:3000/auth/sign-in-oidc'

const configValues = {
  'defraId.clientId': 'test-client-id',
  'defraId.clientSecret': 'test-client-secret',
  'session.cookie.password': 'some-password-32-chars-long-000000',
  isProduction: false,
  'session.cookie.sameSite': 'Lax',
  'defraId.redirectUrl': SIGN_IN_REDIRECT_URL,
  'defraId.serviceId': 'service-123',
  'defraId.policy': 'policy-abc',
  'defraId.refreshTokens': true,
  'defraId.oidcDiscoveryUrl':
    'https://idp.example.com/.well-known/openid-configuration'
}

const sessionIdInCache = 'session-1'

const buildRequestWithCachedSession = (userSession) => {
  const sessions = new Map(userSession ? [[sessionIdInCache, userSession]] : [])
  return {
    sessions,
    request: {
      server: {
        app: {
          cache: {
            get: async (sessionId) => sessions.get(sessionId) ?? null,
            set: async (sessionId, value) => {
              sessions.set(sessionId, value)
            }
          }
        }
      }
    }
  }
}

const expireToken = () => {
  jwtDecodeMock.mockReturnValue({ exp: 1 })
  jwtVerifyTimeMock.mockImplementation(() => {
    throw new Error('token expired')
  })
}

describe('auth plugin', () => {
  const oidcConfig = {
    authorization_endpoint: 'https://idp.example.com/auth',
    token_endpoint: 'https://idp.example.com/token'
  }

  restoreConfigAfterEach(Object.keys(configValues))

  beforeEach(() => {
    vi.resetAllMocks()

    for (const [key, value] of Object.entries(configValues)) {
      config.set(key, value)
    }
    wreckGetMock.mockResolvedValue({ payload: oidcConfig })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('register', () => {
    const buildServer = async () => {
      const server = hapi.server()
      server.decorate('server', 'logger', createLogger())
      await server.register([hapiCookie, hapiBell])
      return server
    }

    test('registers Bell with the discovered authorization endpoint and the configured client', async () => {
      const server = await buildServer()
      await server.register(authPlugin)
      server.route({
        method: 'GET',
        path: '/sign-in-with-defra-id',
        options: { auth: 'defra-id' },
        handler: () => 'signed in'
      })

      const response = await server.inject('/sign-in-with-defra-id')

      const location = new URL(response.headers.location)
      expect(response.statusCode).toBe(302)
      expect(`${location.origin}${location.pathname}`).toBe(
        oidcConfig.authorization_endpoint
      )
      expect(Object.fromEntries(location.searchParams)).toMatchObject({
        client_id: 'test-client-id',
        redirect_uri: SIGN_IN_REDIRECT_URL,
        serviceId: 'service-123',
        p: 'policy-abc',
        response_mode: 'query'
      })
    })

    test('sets default auth to the session cookie strategy', async () => {
      const server = await buildServer()
      await server.register(authPlugin)
      server.route({ method: 'GET', path: '/private', handler: () => 'ok' })

      const response = await server.inject('/private')

      expect(response.statusCode).toBe(302)
      expect(response.headers.location).toBe('/auth/sign-in?redirect=/private')
    })

    test('registers no Bell strategy when OIDC discovery fails', async () => {
      vi.useFakeTimers()
      wreckGetMock.mockRejectedValue(new Error('connection refused'))
      const server = await buildServer()

      const registration = expect(server.register(authPlugin)).rejects.toThrow(
        'OIDC discovery at'
      )
      await vi.advanceTimersByTimeAsync(7000)
      await registration

      expect(() =>
        server.route({
          method: 'GET',
          path: '/sign-in-with-defra-id',
          options: { auth: 'defra-id' },
          handler: () => 'signed in'
        })
      ).toThrow(/defra-id/)
    })
  })

  describe('getBellOptions', () => {
    test('provider.token is the discovered token endpoint', () => {
      expect(getBellOptions(oidcConfig).provider.token).toBe(
        oidcConfig.token_endpoint
      )
    })

    test('sets the configured SameSite on the Bell state cookie', () => {
      config.set('session.cookie.sameSite', 'Strict')

      expect(getBellOptions(oidcConfig).isSameSite).toBe('Strict')
    })

    test('location stores the safe redirect and returns redirectUrl', () => {
      const stored = {}
      const request = {
        query: { redirect: '/some/path?x=1' },
        yar: { set: (key, value) => (stored[key] = value) }
      }

      const location = getBellOptions(oidcConfig).location(request)

      expect(stored).toEqual({ redirect: '/some/path?x=1' })
      expect(location).toBe(SIGN_IN_REDIRECT_URL)
    })

    test('location stores the home page when the requested redirect is unsafe', () => {
      const stored = {}
      const request = {
        query: { redirect: 'https://evil.example/path' },
        yar: { set: (key, value) => (stored[key] = value) }
      }

      getBellOptions(oidcConfig).location(request)

      expect(stored).toEqual({ redirect: '/' })
    })

    test('location stores nothing when no redirect is requested', () => {
      const stored = {}
      const request = {
        query: {},
        yar: { set: (key, value) => (stored[key] = value) }
      }

      const location = getBellOptions(oidcConfig).location(request)

      expect(stored).toEqual({})
      expect(location).toBe(SIGN_IN_REDIRECT_URL)
    })

    test('providerParams adds forceReselection for /auth/organisation', () => {
      const options = getBellOptions(oidcConfig)

      const base = options.providerParams({
        path: '/some/other-path',
        query: {}
      })

      expect(base).toEqual({
        serviceId: 'service-123',
        p: 'policy-abc',
        response_mode: 'query'
      })

      const withForce = options.providerParams({
        path: '/auth/organisation',
        query: {}
      })

      expect(withForce).toEqual({
        serviceId: 'service-123',
        p: 'policy-abc',
        response_mode: 'query',
        forceReselection: true
      })

      const withRelationshipId = options.providerParams({
        path: '/auth/organisation',
        query: { organisationId: 'org-999' }
      })

      expect(withRelationshipId).toEqual({
        serviceId: 'service-123',
        p: 'policy-abc',
        response_mode: 'query',
        forceReselection: true,
        relationshipId: 'org-999'
      })
    })

    test('provider.profile maps decoded JWT payload to credentials.profile', () => {
      const credentials = { token: 'jwt-token' }
      jwtDecodeMock.mockReturnValue({
        decoded: {
          payload: {
            contactId: 'CRN123',
            firstName: 'Andrew',
            lastName: 'Farmer',
            currentRelationshipId: 'REL-1'
          }
        }
      })

      getBellOptions(oidcConfig).provider.profile(credentials)

      expect(credentials.profile).toEqual({
        contactId: 'CRN123',
        firstName: 'Andrew',
        lastName: 'Farmer',
        currentRelationshipId: 'REL-1',
        crn: 'CRN123',
        name: 'Andrew Farmer',
        organisationId: 'REL-1'
      })
    })
  })

  describe('getCookieOptions', () => {
    test('redirectTo builds /auth/sign-in redirect including pathname and search', () => {
      const redirect = getCookieOptions().redirectTo({
        url: { pathname: '/origin', search: '?a=1' }
      })

      expect(redirect).toBe('/auth/sign-in?redirect=/origin?a=1')
    })

    test('validate returns isValid:false when session does not exist in cache', async () => {
      const { request } = buildRequestWithCachedSession(null)

      const res = await getCookieOptions().validate(request, {
        sessionId: 'missing'
      })

      expect(res).toEqual({ isValid: false })
    })

    test('validate returns isValid:true when token verification succeeds', async () => {
      const userSession = { token: 'token', refreshToken: 'refresh-token' }
      const { request, sessions } = buildRequestWithCachedSession(userSession)
      jwtDecodeMock.mockReturnValue({ exp: 999999 })
      jwtVerifyTimeMock.mockImplementation(() => undefined)

      const res = await getCookieOptions().validate(request, {
        sessionId: sessionIdInCache
      })

      expect(res).toEqual({ isValid: true, credentials: userSession })
      expect(wreckPostMock).not.toHaveBeenCalled()
      expect(sessions.get(sessionIdInCache)).toEqual({
        token: 'token',
        refreshToken: 'refresh-token'
      })
    })

    test('validate refreshes tokens when verification fails and refreshTokens enabled', async () => {
      const { request, sessions } = buildRequestWithCachedSession({
        token: 'old-token',
        refreshToken: 'old-refresh'
      })
      expireToken()
      wreckPostMock.mockResolvedValue({
        payload: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token'
        }
      })
      const refreshed = {
        token: 'new-access-token',
        refreshToken: 'new-refresh-token'
      }

      const res = await getCookieOptions().validate(request, {
        sessionId: sessionIdInCache
      })

      expect(wreckPostMock).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(
            `^${oidcConfig.token_endpoint}\\?.*refresh_token=old-refresh`
          )
        ),
        expect.anything()
      )
      expect(sessions.get(sessionIdInCache)).toEqual(refreshed)
      expect(res).toEqual({ isValid: true, credentials: refreshed })
    })

    test('validate returns isValid:false when verification fails and refreshTokens disabled', async () => {
      config.set('defraId.refreshTokens', false)
      const { request, sessions } = buildRequestWithCachedSession({
        token: 'old-token',
        refreshToken: 'old-refresh'
      })
      expireToken()

      const res = await getCookieOptions().validate(request, {
        sessionId: sessionIdInCache
      })

      expect(res).toEqual({ isValid: false })
      expect(wreckPostMock).not.toHaveBeenCalled()
      expect(sessions.get(sessionIdInCache)).toEqual({
        token: 'old-token',
        refreshToken: 'old-refresh'
      })
    })
  })
})
