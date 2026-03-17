import { notificationsController } from './controller.js'

/**
 * Sets up the routes used in the notifications page.
 * These routes are registered in src/server/router.js.
 */
export const notifications = {
  plugin: {
    name: 'notifications',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/notifications',
          ...notificationsController
        }
      ])
    }
  }
}
