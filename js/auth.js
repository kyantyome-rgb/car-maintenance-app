/**
 * 認証モジュール（Google Sign-In / Google Identity Services）。
 *   - 本番: GIS でユーザーがGoogleログイン → IDトークン(JWT)を取得し、API呼び出しに付与。
 *           バックエンドが tokeninfo で検証し、検証済みメールをホワイトリスト照合する。
 *   - デモ: Googleなしで自動ログイン（プレビュー/開発用）。
 *
 * クライアントでの JWT デコードは「表示用」。信頼境界はサーバー側の検証。
 */
window.Auth = (function () {
  var C = window.CONFIG;
  var state = { user: null, idToken: '', ready: false };
  var changeCb = null;

  function decodeJwt(t) {
    try {
      var p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(p))));
    } catch (e) { return {}; }
  }

  function setOnChange(fn) { changeCb = fn; }

  async function init() {
    if (C.DEMO_MODE) {
      state.user = { email: 'kyantyome@gmail.com', name: 'kyan', picture: '' };
      state.idToken = 'demo';
      state.ready = true;
      return;
    }
    // セッション中の保存トークンを復元（有効期限内なら）
    var saved = sessionStorage.getItem('mycar.idtoken');
    if (saved) {
      var c = decodeJwt(saved);
      if (c.exp && c.exp * 1000 > Date.now() + 30000) {
        state.idToken = saved;
        state.user = { email: c.email, name: c.name, picture: c.picture };
      } else {
        sessionStorage.removeItem('mycar.idtoken');
      }
    }
    await loadGis();
    state.ready = true;
  }

  function loadGis() {
    return new Promise(function (res) {
      if (window.google && window.google.accounts) { initGis(); return res(); }
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      s.onload = function () { initGis(); res(); };
      s.onerror = function () { res(); };
      document.head.appendChild(s);
    });
  }

  function initGis() {
    if (!window.google || !window.google.accounts || !C.GOOGLE_CLIENT_ID) return;
    window.google.accounts.id.initialize({
      client_id: C.GOOGLE_CLIENT_ID,
      callback: handleCredential,
      auto_select: true,
      cancel_on_tap_outside: false
    });
  }

  function handleCredential(resp) {
    if (!resp || !resp.credential) return;
    state.idToken = resp.credential;
    var c = decodeJwt(resp.credential);
    state.user = { email: c.email, name: c.name, picture: c.picture };
    sessionStorage.setItem('mycar.idtoken', resp.credential);
    if (changeCb) changeCb(state.user);
  }

  // ログイン画面にGoogleボタンを描画＋One Tap
  function renderButton(container) {
    if (!window.google || !window.google.accounts || !C.GOOGLE_CLIENT_ID) {
      container.innerHTML = '<div class="login-err">Google ログインを初期化できません。<br>config.js の GOOGLE_CLIENT_ID を設定してください。</div>';
      return;
    }
    window.google.accounts.id.renderButton(container, {
      theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', locale: 'ja', width: 260
    });
    try { window.google.accounts.id.prompt(); } catch (e) {}
  }

  function signedIn() { return !!state.idToken && !!state.user; }
  function user() { return state.user; }
  function idToken() { return state.idToken; }

  function signOut() {
    state.user = null; state.idToken = '';
    sessionStorage.removeItem('mycar.idtoken');
    try { if (window.google && window.google.accounts) window.google.accounts.id.disableAutoSelect(); } catch (e) {}
  }

  return {
    init: init, setOnChange: setOnChange, renderButton: renderButton,
    signedIn: signedIn, user: user, idToken: idToken, signOut: signOut, isDemo: function () { return !!C.DEMO_MODE; }
  };
})();
