import { afterEach, beforeEach, vi } from 'vitest'

const firstArgument = ([line]) => line
const isJsonLine = (line) => typeof line === 'string' && line.startsWith('{')
const isEmfDocument = (document) => Boolean(document._aws)

/**
 * Records the EMF documents written to the console during each test of the
 * enclosing `describe`. Needs `AWS_EMF_ENVIRONMENT=Local`, which the test
 * scripts set.
 *
 * @returns {{ documents: () => object[], documentsWith: (metricName: string) => object[] }}
 */
export const recordEmfDocuments = () => {
  let logSpy

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  const documents = () =>
    logSpy.mock.calls
      .map(firstArgument)
      .filter(isJsonLine)
      .map((line) => JSON.parse(line))
      .filter(isEmfDocument)

  return {
    documents,
    documentsWith: (metricName) =>
      documents().filter((document) => metricName in document)
  }
}
