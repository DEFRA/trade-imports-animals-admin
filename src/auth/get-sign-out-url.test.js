import { config } from '../config/config.js'
import { getSignOutUrl } from './get-sign-out-url.js'
import { restoreConfigAfterEach } from '../server/common/test-helpers/restore-config-after-each.js'

const DEFAULT_CONFIG = {
  'defraId.browserFacingHostnameRewrite.enabled': true,
  'defraId.browserFacingHostnameRewrite.from': [
    'host.docker.internal',
    'trade-imports-defra-id-stub'
  ],
  'defraId.browserFacingHostnameRewrite.to': 'localhost'
}

const configKeys = [...Object.keys(DEFAULT_CONFIG), 'defraId.oidcDiscoveryUrl']

function setConfig(overrides) {
  for (const [key, value] of Object.entries({
    ...DEFAULT_CONFIG,
    ...overrides
  })) {
    config.set(key, value)
  }
}

describe('getSignOutUrl', () => {
  restoreConfigAfterEach(configKeys)

  test('builds signout URL from discovery URL', async () => {
    setConfig({
      'defraId.oidcDiscoveryUrl':
        'https://mock-auth-server/some/tenant/.well-known/openid-configuration'
    })

    const url = await getSignOutUrl({}, 'token')

    expect(url).toBe('https://mock-auth-server/some/tenant/signout')
  })

  test('handles discovery URL at root /.well-known/openid-configuration', async () => {
    setConfig({
      'defraId.oidcDiscoveryUrl':
        'https://mock-auth-server/.well-known/openid-configuration'
    })

    const url = await getSignOutUrl({}, 'token')

    expect(url).toBe('https://mock-auth-server/signout')
  })

  test('rewrites configured Docker internal OIDC hostnames using configured target hostname', async () => {
    setConfig({
      'defraId.oidcDiscoveryUrl':
        'http://host.docker.internal:3007/idphub/b2c/b2c_1a/.well-known/openid-configuration'
    })

    const url = await getSignOutUrl({}, 'token')

    expect(url).toBe('http://localhost:3007/idphub/b2c/b2c_1a/signout')
  })

  test('rewrites trade-imports-defra-id-stub hostname when configured', async () => {
    setConfig({
      'defraId.oidcDiscoveryUrl':
        'http://trade-imports-defra-id-stub:3007/idphub/b2c/b2c_1a/.well-known/openid-configuration'
    })

    const url = await getSignOutUrl({}, 'token')

    expect(url).toBe('http://localhost:3007/idphub/b2c/b2c_1a/signout')
  })

  test('does not rewrite when hostname rewrite is disabled in config', async () => {
    setConfig({
      'defraId.oidcDiscoveryUrl':
        'http://host.docker.internal:3007/idphub/b2c/b2c_1a/.well-known/openid-configuration',
      'defraId.browserFacingHostnameRewrite.enabled': false
    })

    const url = await getSignOutUrl({}, 'token')

    expect(url).toBe(
      'http://host.docker.internal:3007/idphub/b2c/b2c_1a/signout'
    )
  })
})
