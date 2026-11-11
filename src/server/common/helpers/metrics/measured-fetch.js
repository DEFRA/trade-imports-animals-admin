import { recordFailure, recordSuccess } from './external-call-recorder.js'

/**
 * Calls `fetch` and records the call against its dependency and operation. A
 * response with a status of 400 or over, or a thrown error, is a failure. The
 * response is returned and the error rethrown as `fetch` gave them.
 *
 * @param {{ dependency: string, operation: string }} externalCall - the call
 * @param {string} url - the URL to fetch
 * @param {RequestInit} options - the fetch options
 * @returns {Promise<Response>} the response
 */
export const measuredFetch = async (externalCall, url, options) => {
  const startedAt = performance.now()
  try {
    const response = await fetch(url, options)
    const durationMs = performance.now() - startedAt
    if (response.ok) {
      recordSuccess(externalCall, durationMs)
    } else {
      recordFailure(externalCall, durationMs)
    }
    return response
  } catch (error) {
    recordFailure(externalCall, performance.now() - startedAt, error)
    throw error
  }
}
