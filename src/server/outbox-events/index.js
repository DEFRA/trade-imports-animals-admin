import { outboxEventsController } from './controller.js'

/**
 * Sets up the routes used in the outbox events page.
 * These routes are registered in src/server/router.js.
 */
export const outboxEvents = {
  plugin: {
    name: 'outbox-events',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/outbox-events',
          ...outboxEventsController
        }
      ])
    }
  }
}
