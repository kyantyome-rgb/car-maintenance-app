/* オフラインキャッシュ＋通知。シェルをプリキャッシュしつつ、同一オリジンはネット優先
   （最新コードを反映しつつ、オフライン時はキャッシュにフォールバック）。 */
var CACHE = 'mycar-v10';
var SHELL = [
  './', './index.html', './css/styles.css',
  './js/config.js', './js/mock.js', './js/render.js', './js/api.js', './js/auth.js',
  './js/export.js', './js/notify.js', './js/app.js',
  './manifest.webmanifest', './icons/icon.svg'
];

// 設定（API_BASE / APP_TOKEN / DEMO_MODE）を SW でも参照できるよう読み込む
try { importScripts('./js/config.js'); } catch (e) { /* 失敗時は通知の定期取得を無効化 */ }

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = e.request.url;
  // GAS API はキャッシュしない（常に最新）
  if (url.indexOf('script.google.com') !== -1 || e.request.method !== 'GET') return;
  // ネット優先：成功したらキャッシュ更新、失敗（オフライン）時はキャッシュ→indexにフォールバック
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (m) { return m || caches.match('./index.html'); });
    })
  );
});

/* ---------- 通知 ---------- */

// 将来のサーバープッシュ用。payload(JSON) を受け取り通知を表示
self.addEventListener('push', function (e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = { body: e.data && e.data.text() }; }
  var title = data.title || '🔔 MyCar Console';
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: 'icons/icon.svg', badge: 'icons/icon.svg',
    tag: data.tag || 'mycar', renotify: true,
    data: data.data || { url: './index.html' }
  }));
});

// 通知タップ → 既存ウィンドウをフォーカス or 新規に開く
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) { list[i].focus(); return; }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// 定期バックグラウンドチェック（対応端末・インストール済みPWAのみ）
self.addEventListener('periodicsync', function (e) {
  if (e.tag === 'check-alerts') e.waitUntil(fetchDueAndNotify());
});

async function fetchDueAndNotify() {
  // セキュリティ上、通知取得APIは Google ログイン必須にしたため、
  // 認証情報を持てないバックグラウンドSWからは取得しない（no-op）。
  // 通知はアプリ起動・復帰時（認証済みのページ側）でチェックして表示する。
  return;
}
