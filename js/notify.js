/**
 * 通知モジュール。
 *   - 通知許可の取得／解除
 *   - アプリ起動・復帰時に「期限の近い／超過したメンテ」をチェックして通知
 *   - 重複通知は日次でデデュープ（同じ車両・同じ内容は1日1回まで）
 *   - 対応端末では Periodic Background Sync を登録（実際の定期実行は sw.js 側）
 *
 * サーバー常時プッシュ（アプリ未起動でも届く）は GAS 単体では送信できないため、
 * 「開いたとき＋バックグラウンド定期チェック」で通知する設計。
 */
window.Notify = (function () {
  var LS_ENABLED = 'mycar.notify.enabled';
  var LS_PREFIX = 'mycar.notified.';

  function supported() { return ('Notification' in window) && ('serviceWorker' in navigator); }
  function permission() { return supported() ? Notification.permission : 'unsupported'; }
  function isEnabled() { return localStorage.getItem(LS_ENABLED) === '1' && permission() === 'granted'; }

  async function enable() {
    if (!supported()) throw new Error('この端末／ブラウザは通知に対応していません');
    var perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      localStorage.setItem(LS_ENABLED, '0');
      throw new Error(perm === 'denied'
        ? '通知がブロックされています。ブラウザ設定から許可してください'
        : '通知が許可されませんでした');
    }
    localStorage.setItem(LS_ENABLED, '1');
    await registerPeriodicSync();
    return true;
  }

  function disable() { localStorage.setItem(LS_ENABLED, '0'); }

  async function registerPeriodicSync() {
    try {
      var reg = await navigator.serviceWorker.ready;
      if ('periodicSync' in reg) {
        var status = await navigator.permissions.query({ name: 'periodic-background-sync' });
        if (status.state === 'granted') {
          await reg.periodicSync.register('check-alerts', { minInterval: 24 * 60 * 60 * 1000 });
        }
      }
    } catch (e) { /* 非対応はスルー */ }
  }

  async function getReg() {
    if (navigator.serviceWorker.controller || navigator.serviceWorker.ready) {
      try { return await navigator.serviceWorker.ready; } catch (e) {}
    }
    return null;
  }

  /**
   * 期限の近い／超過した項目を集計して通知。
   * @param {Object} opts {force:true で許可確認だけ済めば必ず通知}
   * @return {number} 通知した車両数
   */
  async function checkAndNotify(opts) {
    opts = opts || {};
    if (!opts.force && !isEnabled()) return 0;
    if (permission() !== 'granted') return 0;
    var reg = await getReg();
    if (!reg) return 0;

    var today = new Date().toISOString().slice(0, 10);
    var due = [];
    try { due = await API.get('getDueNotifications'); } catch (e) { return 0; }

    var count = 0;
    for (var i = 0; i < due.length; i++) {
      var v = due[i];
      if (!v.items || !v.items.length) continue;
      var lsKey = LS_PREFIX + v.vehicle_id;
      var prev = {};
      try { prev = JSON.parse(localStorage.getItem(lsKey) || '{}'); } catch (e) {}
      // 今日すでに同じ内容を通知済みならスキップ
      if (!opts.force && prev.date === today && prev.sig === v.sig) continue;

      await reg.showNotification('🔔 ' + v.vehicle_name + ' メンテナンス通知', {
        body: v.items.join('\n'),
        tag: 'mycar-' + v.vehicle_id,
        renotify: true,
        requireInteraction: false,
        icon: 'icons/icon.svg',
        badge: 'icons/icon.svg',
        data: { url: './index.html', vehicle_id: v.vehicle_id }
      });
      localStorage.setItem(lsKey, JSON.stringify({ date: today, sig: v.sig }));
      count++;
    }
    return count;
  }

  /** テスト通知 */
  async function test() {
    if (permission() !== 'granted') { await enable(); }
    var reg = await getReg();
    if (!reg) throw new Error('Service Worker が未登録です');
    await reg.showNotification('🔔 MyCar Console', {
      body: 'テスト通知です。メンテ時期や車検期限が近づくとこのようにお知らせします。',
      icon: 'icons/icon.svg', badge: 'icons/icon.svg',
      tag: 'mycar-test', data: { url: './index.html' }
    });
  }

  return { supported: supported, permission: permission, isEnabled: isEnabled,
           enable: enable, disable: disable, checkAndNotify: checkAndNotify, test: test };
})();
