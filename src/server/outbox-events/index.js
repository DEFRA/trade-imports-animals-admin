import {
  outboxEventsController,
  outboxEventsReplayController
} from './controller.js'

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
        },
        {
          method: 'POST',
          path: '/outbox-events/replay',
          options: {
            payload: {
              parse: true,
              allow: 'application/x-www-form-urlencoded'
            }
          },
          handler: outboxEventsReplayController.handler
        }
      ])
    }
  }
}
