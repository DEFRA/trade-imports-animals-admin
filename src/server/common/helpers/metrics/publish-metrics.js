import { Metrics } from '@defra/cdp-metrics'

import { config } from '../../../../config/config.js'
import { createLogger } from '../logging/logger.js'

const logger = createLogger()

const writeDocument = async (dimensions, values) => {
  const metricsLogger = new Metrics(logger).getMetricsLogger(dimensions)
  metricsLogger.setNamespace(config.get('metrics.namespace'))
  for (const { name, value, unit } of values) {
    metricsLogger.putMetric(name, value, unit)
  }
  await metricsLogger.flush()
}

/**
 * Writes one EMF document holding the values, with the dimensions as its only
 * dimension set, without making the caller wait. Logs a warning when the
 * document cannot be written.
 *
 * @param {Record<string, string>} dimensions - the document's dimensions
 * @param {Array<{ name: string, value: number, unit: string }>} values - the metric values
 */
export const publishMetrics = (dimensions, values) => {
  writeDocument(dimensions, values).catch((err) => {
    logger.warn({ err, dimensions }, 'Could not publish metrics')
  })
}
