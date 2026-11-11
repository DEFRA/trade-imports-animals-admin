import { publishMetrics } from './publish-metrics.js'

/**
 * Counts one replay or delete that succeeded, as `admin.action` with the
 * dimension `action`.
 *
 * @param {'notification.replay' | 'notification.delete' | 'dlq.replay-all' | 'dlq.delete-all'} action - the action
 */
export const recordAdminAction = (action) =>
  publishMetrics({ action }, [
    { name: 'admin.action', value: 1, unit: 'Count' }
  ])
