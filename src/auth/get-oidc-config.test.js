import { vi } from 'vitest'

import { config } from '../config/config.js'
import { restoreConfigAfterEach } from '../server/common/test-helpers/restore-config-after-each.js'
import { getOidcConfig } from './get-oidc-config.js'

const wreckGetMock = vi.hoisted(() => vi.fn())

vi.mock('@hapi/wreck', () => ({
  default: { get: wreckGetMock }
}))

describe('getOidcConfig', () => {
  const discoveryUrl =
    'https://mock-auth-server/idp/.well-known/openid-configuration'

  restoreConfigAfterEach(['defraId.oidcDiscoveryUrl'])

  beforeEach(() => {
    wreckGetMock.mockReset()
    config.set('defraId.oidcDiscoveryUrl', discoveryUrl)
  })

  test('fetches discovery document and returns payload', async () => {
    const payload = { authorization_endpoint: 'https://idp/auth' }

    wreckGetMock.mockResolvedValue({ payload })

    await expect(getOidcConfig()).resolves.toEqual(payload)

    expect(wreckGetMock).toHaveBeenCalledWith(discoveryUrl, {
      json: true,
      timeout: 1000
    })
  })

  test('propagates Wreck errors', async () => {
    wreckGetMock.mockRejectedValue(new Error('discovery failed'))

    await expect(getOidcConfig()).rejects.toThrow('discovery failed')
    expect(wreckGetMock).toHaveBeenCalledWith(discoveryUrl, {
      json: true,
      timeout: 1000
    })
  })
})
