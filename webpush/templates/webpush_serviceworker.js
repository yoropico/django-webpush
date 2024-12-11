
// Register event listener for the 'push' event.lib-static
//webpush_serviceworker.js
//lib/static/1129
self.addEventListener('push', function(event) {
  let payload = event.data ? event.data.text() : '{"head": "No Content", "body": "No Content", "icon": "", "badge": 0, "url": "/"}';
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error('Push event data is not JSON:', e);
    }
  }

  const head = data.head || "새 알림";
  const body = data.body || "새로운 알림이 도착했습니다.";
  const icon = data.icon || '/static/images/icons/icon-192x192.png';
  const badgeCount = typeof data.badge === 'number' ? data.badge : parseInt(data.badge) || 0;
  const url = data.url || self.location.origin;

  const options = {
    body: body,
    icon: icon,
    badge: badgeCount,
    data: {
      url: url
    },
    // 필요에 따라 다른 옵션 추가
  };

  event.waitUntil(
        self.registration.showNotification(head, options).then(() => {
            if (self.clients) {
                self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
                    clientList.forEach(client => {
                        console.log('Sending badge count to client:', badgeCount); // 로그 추가
                        client.postMessage({ badge: badgeCount });
                    });
                });
            }
        })
    );
});

// 푸시 알림 클릭 시 해당 URL로 이동 및 배지 초기화
self.addEventListener('notificationclick', function(event) {
    console.log('Notification click received:', event);
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            clientList.forEach(client => {
                console.log('Sending badge count reset to client'); // 로그 추가
                client.postMessage({ badge: 0 });
            });
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url);
            }
        })
    );
});