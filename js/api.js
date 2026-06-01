/**
 * APIクライアント。DEMO_MODE では MockBackend に委譲。
 * 本番では GAS /exec を呼ぶ。CORSプリフライト回避のため POST は text/plain。
 */
window.API = (function () {
  var C = window.CONFIG;
  var authHandler = null; // 認証切れ時に呼ぶフック（ログイン画面へ）

  function setAuthHandler(fn) { authHandler = fn; }

  function buildParams(action, params) {
    return Object.assign({
      action: action,
      token: C.APP_TOKEN,                                       // 公開系API/通知取得の保護用
      id_token: (window.Auth && Auth.idToken()) || ''           // ユーザー認証（GoogleIDトークン）
    }, params || {});
  }

  async function call(action, params, opts) {
    opts = opts || {};
    if (C.DEMO_MODE) return window.MockBackend.handle(action, params);

    var req = buildParams(action, params);
    var url = C.API_BASE;
    var res;
    if (opts.method === 'POST') {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // simple request → プリフライト無し
        body: JSON.stringify(req)
      });
    } else {
      var qs = Object.keys(req).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(req[k]); }).join('&');
      res = await fetch(url + '?' + qs, { method: 'GET' });
    }
    var json = await res.json();
    if (!json.ok) {
      if (json.auth && authHandler) authHandler(json.error);  // 認証切れ → 再ログイン
      throw new Error(json.error || 'API error');
    }
    return json.data;
  }

  return {
    setAuthHandler: setAuthHandler,
    get: function (action, params) { return call(action, params, { method: 'GET' }); },
    post: function (action, params) { return call(action, params, { method: 'POST' }); }
  };
})();
