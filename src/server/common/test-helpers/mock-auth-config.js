export async function mockAuthConfig(importOriginal) {
  const { config } = await importOriginal()
  const originalGet = config.get.bind(config)
  return {
    config: { get: (key) => (key === 'auth.enabled' ? true : originalGet(key)) }
  }
}
