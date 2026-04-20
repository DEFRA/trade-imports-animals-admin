import {
  notificationsController,
  deleteNotificationsController,
  viewNotificationController,
  downloadDocumentController
} from './controller.js'

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
        },
        {
          method: 'GET',
          path: '/notifications/{ref}',
          ...viewNotificationController
        },
        {
          method: 'GET',
          path: '/notifications/{ref}/documents/{uploadId}/files/{fileId}',
          ...downloadDocumentController
        },
        {
          method: 'DELETE',
          path: '/notifications',
          ...deleteNotificationsController
        }
      ])
    }
  }
}
