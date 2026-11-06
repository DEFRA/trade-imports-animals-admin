import { config } from '../config/config.js'

async function getSignOutUrl(_request, _token) {
  const oidcBaseUrl = new URL(config.get('defraId.oidcDiscoveryUrl'))
  const rewriteEnabled = config.get(
    'defraId.browserFacingHostnameRewrite.enabled'
  )
  const rewriteHosts = new Set(
    config.get('defraId.browserFacingHostnameRewrite.from')
  )
  const rewriteTarget = config.get('defraId.browserFacingHostnameRewrite.to')

  if (rewriteEnabled && rewriteHosts.has(oidcBaseUrl.hostname)) {
    oidcBaseUrl.hostname = rewriteTarget
  }

  const basePath = oidcBaseUrl.pathname.replace(
    '/.well-known/openid-configuration',
    ''
  )
  const base = `${oidcBaseUrl.origin}${basePath}`
  return `${base}/signout`
}

export { getSignOutUrl }
