export async function mockAuthConfig(
  importOriginal,
  { authEnabled = true } = {}
) {
  const { config } = await importOriginal()
  const originalGet = config.get.bind(config)
  return {
    config: {
      get: (key) => (key === 'auth.enabled' ? authEnabled : originalGet(key))
    }
  }
}
