import { dlqEventsController, dlqEventsActionController } from './controller.js'

/**
 * Sets up the routes used in the DLQ process page.
 * These routes are registered in src/server/router.js.
 */
export const dlqEvents = {
  plugin: {
    name: 'dlq-events',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/dlq-events',
          ...dlqEventsController
        },
        {
          method: 'POST',
          path: '/dlq-events',
          ...dlqEventsActionController
        }
      ])
    }
  }
}
