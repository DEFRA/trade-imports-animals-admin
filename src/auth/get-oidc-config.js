import Wreck from '@hapi/wreck'
import { config } from '../config/config.js'

// Wreck arms this timeout twice per call — once for the request, again for the
// body read — so one attempt can cost 2x this before it rejects.
const OIDC_TIMEOUT_MS = 1000

async function getOidcConfig() {
  // Fetch the OpenID Connect configuration from the well-known endpoint
  // Contains the URLs for authorisation, sign out, token and public keys in JSON format
  const { payload } = await Wreck.get(config.get('defraId.oidcDiscoveryUrl'), {
    json: true,
    timeout: OIDC_TIMEOUT_MS
  })

  return payload
}

export { getOidcConfig, OIDC_TIMEOUT_MS }
