self.addEventListener('push', function(event) {
  if (!event.data) return
  const data = event.data.json()
  const options = {
    body: data.message || data.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: { url: data.action_url || '/' },
    tag: data.notification_type || 'default',
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'DOT Copilot', options)
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})
