import { createLogger } from '../logging/logger.js'
import { publishMetrics } from './publish-metrics.js'

const logger = createLogger()

const SUCCESS = 'success'
const FAILURE = 'failure'

const publishCall = ({ dependency, operation }, durationMs, outcome) =>
  publishMetrics({ dependency, operation }, [
    {
      name: 'external.call.duration',
      value: durationMs,
      unit: 'Milliseconds'
    },
    {
      name: 'external.call.failure',
      value: outcome === FAILURE ? 1 : 0,
      unit: 'Count'
    }
  ])

const logCall = ({ dependency, operation }, durationMs, outcome, cause) => {
  const action = `${dependency}/${operation}`
  const nanosPerMilli = 1_000_000
  const fields = {
    event: {
      category: 'external-call',
      action,
      outcome,
      duration: Math.round(durationMs * nanosPerMilli)
    }
  }
  if (cause) {
    fields['error.type'] = cause.name
    fields['error.message'] = cause.message
  }
  const message = `External call ${action} ${outcome} in ${Math.round(durationMs)} ms`
  if (outcome === SUCCESS) {
    logger.info(fields, message)
  } else {
    logger.warn(fields, message)
  }
}

const record = (externalCall, durationMs, outcome, cause) => {
  publishCall(externalCall, durationMs, outcome)
  logCall(externalCall, durationMs, outcome, cause)
}

/**
 * Records a call to a dependency that succeeded: one EMF document holding
 * `external.call.duration` and `external.call.failure` (0), and one info line.
 *
 * @param {{ dependency: string, operation: string }} externalCall - the call
 * @param {number} durationMs - how long the call took
 */
export const recordSuccess = (externalCall, durationMs) =>
  record(externalCall, durationMs, SUCCESS)

/**
 * Records a call to a dependency that failed: one EMF document holding
 * `external.call.duration` and `external.call.failure` (1), and one warn line
 * carrying the cause's name and message as `error.type` and `error.message`.
 *
 * @param {{ dependency: string, operation: string }} externalCall - the call
 * @param {number} durationMs - how long the call took
 * @param {Error} [cause] - what the call threw, if it threw
 */
export const recordFailure = (externalCall, durationMs, cause) =>
  record(externalCall, durationMs, FAILURE, cause)
