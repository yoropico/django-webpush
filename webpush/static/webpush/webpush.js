// Based On https://github.com/chrisdavidmills/push-api-demo/blob/283df97baf49a9e67705ed08354238b83ba7e9d3/main.js
//lib/static/1209
var isPushEnabled = false,
    registration = null,
    subBtn,
    SAVE_INFORMATION_URL,
    DELETE_INFORMATION_URL,
    CHECK_SUBSCRIPTION_STATUS_URL,
    NOTIFICATION_COUNT_URL;

window.addEventListener('load', function() {
    console.log('Page loaded');
    subBtn = document.getElementById('webpush-subscribe-button');

    if (!subBtn) {
        console.error('Subscribe button not found in the DOM.');
        return;
    }

    // 템플릿에서 전달된 URL을 변수에 할당
    SAVE_INFORMATION_URL = subBtn.dataset.saveUrl;
    DELETE_INFORMATION_URL = subBtn.dataset.deleteUrl;
    CHECK_SUBSCRIPTION_STATUS_URL = subBtn.dataset.checkUrl;
    NOTIFICATION_COUNT_URL = subBtn.dataset.notificationCountUrl;

    // 디버깅을 위해 URL을 출력
    console.log("CHECK_SUBSCRIPTION_STATUS_URL:", CHECK_SUBSCRIPTION_STATUS_URL);
    console.log("SAVE_INFORMATION_URL:", SAVE_INFORMATION_URL);
    console.log("DELETE_INFORMATION_URL:", DELETE_INFORMATION_URL);
    console.log("NOTIFICATION_COUNT_URL:", NOTIFICATION_COUNT_URL);

    // NOTIFICATION_COUNT_URL이 정의되지 않은 경우 에러 메시지 출력
    if (!NOTIFICATION_COUNT_URL) {
        console.error('Notification Count URL is not defined.');
        showMessage('알림 카운트 URL이 설정되지 않았습니다.');
    } else {
        updateBadgeCount();
    }

    subBtn.textContent = gettext('알림 메시지 수신 허용');

    subBtn.addEventListener('click', function () {
        subBtn.disabled = true;
        if (isPushEnabled) {
            unsubscribe();
        } else {
            subscribe();
        }
    });

    // Do everything if the Browser Supports Service Worker
    if ('serviceWorker' in navigator) {
        const serviceWorker = document.querySelector('meta[name="service-worker-js"]').content;
        if (!serviceWorker) {
            console.error('Service worker script path not found in meta tag.');
            showMessage('서비스 워커 스크립트 경로가 누락되었습니다.');
            subBtn.disabled = false;
            return;
        }

        navigator.serviceWorker.register(serviceWorker).then(function (reg) {
            registration = reg;
            initialiseState();
            listenToServiceWorkerMessages();
        }).catch(function (error) {
            console.error('Service Worker registration failed:', error);
            showMessage('서비스 워커 등록에 실패했습니다.');
        }).finally(function() {
            subBtn.disabled = false; // 서비스 워커 등록 후 버튼 활성화
        });
    } else {
        showMessage('서비스 워커가 브라우저에서 지원되지 않습니다.');
    }
});
  // Once the service worker is registered set the initial state
  function initialiseState() {
      console.log('Initialising state with registration:', registration);
      // Are Notifications supported in the service worker?
      if (!registration.showNotification) {
          // Show a message and activate the button
          showMessage('이 브라우저에서는 알림이 지원되지 않습니다.');
          return;
      }

      // Check the current Notification permission.
      // If its denied, it's a permanent block until the
      // user changes the permission
      if (Notification.permission === 'denied') {
          // Show a message and activate the button
          subBtn.disabled = false;
          showMessage('푸시 알림이 브라우저에서 차단되었습니다.');
          return;
      }

      // Check if push messaging is supported
      if (!('PushManager' in window)) {
          // Show a message and activate the button
          subBtn.disabled = false;
          showMessage('이 브라우저에서는 푸시 알림을 지원하지 않습니다.');
          return;
      }

      // We need to get subscription state for push notifications and send the information to server
      // Get the current subscription
      registration.pushManager.getSubscription().then(function (subscription) {
          if (subscription) {
              console.log('Existing subscription found:', subscription);
              checkSubscriptionStatus(subscription);
          } else {
              // No subscription found
              console.log('No existing subscription found.');
              updateButton(false);
          }
      }).catch(function (error) {
          console.error('Failed to get subscription:', error);
          subBtn.disabled = false;
      });
  }

// 서비스 워커 메시지 리스너
function listenToServiceWorkerMessages() {
    navigator.serviceWorker.addEventListener('message', function (event) {
        console.log('Received message from service worker:', event.data);
        if (event.data && typeof event.data.badge !== 'undefined') {
            handleBadgeUpdate(event.data.badge);
        }
    });
}

// 배지 업데이트 처리
function handleBadgeUpdate(badge) {
    if ('setAppBadge' in navigator) {
        if (badge > 0) {
            navigator.setAppBadge(badge).then(() => {
                console.log(`App badge set to ${badge}`);
                updateUIBadge(badge);
            }).catch(err => {
                console.error('Failed to set app badge:', err);
                // App Badging API 실패 시 fallback
                updateUIBadge(badge);
            });
        } else {
            navigator.clearAppBadge().then(() => {
                console.log('App badge cleared');
                updateUIBadge(0);
            }).catch(err => {
                console.error('Failed to clear app badge:', err);
                // App Badging API 실패 시 fallback
                updateUIBadge(0);
            });
        }
    } else {
        // App Badging API 미지원: 즉시 UI 배지 업데이트
        console.log('App badging API not supported. Updating UI badge directly.');
        updateUIBadge(badge);
    }
}
// checkSubscriptionStatus 함수 수정
async function checkSubscriptionStatus(subscription) {
    const csrfToken = getCSRFToken();
    console.log('CSRF Token:', csrfToken);  // 디버깅 로그

    try {
        const response = await fetch(CHECK_SUBSCRIPTION_STATUS_URL, {  // 수정된 URL
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,  // CSRF 토큰 포함
            },
            credentials: 'same-origin',  // 세션 쿠키 포함
            body: JSON.stringify({ subscription: subscriptionToJSON(subscription) }),  // 전체 subscription 객체 포함
        });

        if (response.ok) {
            const data = await response.json();
            updateButton(data.is_subscribed);
            showMessage(data.is_subscribed ? '푸시 알림 구독에 성공했습니다.' : '푸시 알림 구독 상태가 아닙니다.');
        } else {
            throw new Error('Failed to check subscription status.');
        }
    } catch (error) {
        console.error('Error checking subscription status:', error);
        subBtn.disabled = false;
        showMessage('구독 상태 확인 중 오류가 발생했습니다.');
    }
}
// 버튼 상태 업데이트
function updateButton(isSubscribed) {
    isPushEnabled = isSubscribed;
    subBtn.disabled = false;

    if (isSubscribed) {
        subBtn.innerHTML = '<i class="fas fa-bell-slash fa-2x"></i>';
        subBtn.classList.remove('unsubscribed');
        subBtn.classList.add('subscribed');
        subBtn.setAttribute('aria-label', '푸시 알림 구독 해제');
        subBtn.title = '푸시 알림 구독 해제';
    } else {
        subBtn.innerHTML = '<i class="fas fa-bell fa-2x"></i>';
        subBtn.classList.remove('subscribed');
        subBtn.classList.add('unsubscribed');
        subBtn.setAttribute('aria-label', '푸시 알림 구독');
        subBtn.title = '푸시 알림 구독';
    }
}

// CSRF 토큰 추출 함수
function getCSRFToken() {
    const csrfTokenMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfTokenMeta) {
        console.log("[DEBUG] CSRF token found in meta tag.");
        return csrfTokenMeta.getAttribute('content');
    }
    console.warn("[WARNING] CSRF token not found.");
    return '';
}

// 배지 카운트 업데이트 함수
async function updateBadgeCount() {
    if (!NOTIFICATION_COUNT_URL) {
        console.error('Notification Count URL is undefined. Cannot fetch badge count.');
        return;
    }

    try {
        const response = await fetch(NOTIFICATION_COUNT_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log(`Fetched unread_count from server: ${data.unread_count}`);
        const count = data.unread_count;

        if ('setAppBadge' in navigator) {
            if (count > 0) {
                await navigator.setAppBadge(count);
                console.log(`App badge set to ${count}`);
                updateUIBadge(count);
            } else {
                await navigator.clearAppBadge();
                console.log('App badge cleared');
                updateUIBadge(0);
            }
        } else {
            console.log('App badging API not supported. Updating UI badge directly.');
            updateUIBadge(count);
        }
    } catch (error) {
        console.error('Failed to update badge count:', error);
    }
}



// UI 배지 업데이트 함수
function updateUIBadge(count) {
    const badgeElement = document.getElementById('notificationBadge');
    if (badgeElement) {
        console.log(`Updating UI badge to: ${count}`);
        if (count > 0) {
            badgeElement.textContent = count;
            badgeElement.classList.add('visible');
            badgeElement.classList.remove('d-none');
        } else {
            badgeElement.classList.remove('visible');
            badgeElement.classList.add('d-none');
        }
    } else {
        console.warn('notificationBadge element not found in the DOM.');
    }
}

// 배지 초기화 함수
async function clearBadge() {
    if ('clearAppBadge' in navigator) {
        try {
            await navigator.clearAppBadge();
            console.log('App badge cleared');
        } catch (error) {
            console.error('Failed to clear app badge:', error);
        }
    }
}

function showMessage(message) {
  const messageBox = document.getElementById('webpush-message');
  if (messageBox) {
    messageBox.textContent = message;
    messageBox.style.display = 'block';
    setTimeout(() => {
      messageBox.style.display = 'none';
    }, 5000); // 5초 후 숨김
  }
}
// 구독 등록 함수
async function subscribe() {
    if (!registration) {
        console.error('Service Worker registration is not ready.');
        showMessage('서비스 워커 등록이 완료되지 않았습니다.');
        subBtn.disabled = false;
        return;
    }
    try {
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array(getVapidPublicKey()),
        });

        console.log("New subscription created:", subscription);

        // 서버로 구독 정보 전송
        const response = await postSubscribeObj(SAVE_INFORMATION_URL, 'subscribe', subscription);
        if (response.status === 'subscribed') {
            console.log('Successfully subscribed.');
            updateButton(true);
            showMessage('푸시 알림 구독에 성공했습니다.');
        } else {
            console.error('Subscription failed:', response.error);
            showMessage('구독 중 오류가 발생했습니다.');
        }
    } catch (error) {
        console.error("Subscription failed:", error);
        showMessage('푸시 알림 구독에 실패했습니다.');
        subBtn.disabled = false;
    }
}


function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (var i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// 구독 취소 함수
async function unsubscribe() {
    if (!registration) {
        console.error('Service Worker registration is not ready.');
        showMessage('서비스 워커 등록이 완료되지 않았습니다.');
        subBtn.disabled = false;
        return;
    }
    try {
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            console.log("No subscription found.");
            showMessage('구독 해제할 항목이 없습니다.');
            subBtn.disabled = false;
            return;
        }

        // 서버로 구독 취소 정보 전송
        const response = await postSubscribeObj(DELETE_INFORMATION_URL, 'unsubscribe', subscription);
        if (response.status === 'unsubscribed') {
            // 서버 응답 후 브라우저에서 구독 해제
            await subscription.unsubscribe();
            console.log('Successfully unsubscribed.');
            updateButton(false);
            showMessage('푸시 알림 구독을 해제했습니다.');
        } else {
            console.error('Unsubscription failed:', response.error);
            showMessage('구독 해제 중 오류가 발생했습니다.');
        }
    } catch (error) {
        console.error("Unsubscription failed:", error);
        await subscription.unsubscribe();
        updateButton(false);
        showMessage('푸시 알림 구독을 해제했습니다.');
    } finally {
        subBtn.disabled = false;
    }
}

// 구독 정보를 서버로 전송하는 함수
async function postSubscribeObj(url, statusType, subscription) {
    // 브라우저 정보 수집
    const browserMatch = navigator.userAgent.match(/(firefox|msie|chrome|safari|trident)/ig);
    const browser = browserMatch ? browserMatch[0].toLowerCase() : 'unknown';
    const user_agent = navigator.userAgent;

    // 구독 데이터를 JSON 형태로 변환
    const data = {
        status_type: statusType,
        subscription: subscription ? subscriptionToJSON(subscription) : null,
        browser: browser,
        user_agent: user_agent,
    };

    console.log("Payload to send:", data); // 디버깅 로그

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken(),
        },
        credentials: 'same-origin',
        body: JSON.stringify(data),
    });

     let responseData;
      try {
        responseData = await response.json();
      } catch (e) {
        throw new Error('Invalid JSON response');
      }
    if (!response.ok) {
        if (statusType === 'unsubscribe' && responseData.error === 'Subscription does not exist') {
          // Treat as success if unsubscribing and the subscription does not exist
          return { status: 'unsubscribed' };
        } else {
          throw new Error(responseData.error || 'Server error');
        }
    }

    return responseData;
}

// 구독 객체를 JSON으로 변환하는 함수
function subscriptionToJSON(subscription) {
  if (!subscription) return null;
  const key = subscription.getKey ? subscription.getKey('p256dh') : '';
  const auth = subscription.getKey ? subscription.getKey('auth') : '';

  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(key),
      auth: arrayBufferToBase64(auth),
    },
  };
}

// VAPID 공개 키를 메타 태그에서 가져오는 함수
function getVapidPublicKey() {
  const metaObj = document.querySelector('meta[name="django-webpush-vapid-key"]');
  return metaObj ? metaObj.content : '';
}

// Helper 함수: ArrayBuffer를 Base64로 변환
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}