/**
 * 認証モジュール（Google OAuth 2.0 トークンフロー / ポップアップ）。
 *   - google.accounts.oauth2.initTokenClient を使用（FedCM/One Tap に依存しない確実な方式）。
 *   - ボタンクリックでポップアップ → アクセストークン取得 → API に付与。
 *   - バックエンドが tokeninfo でアクセストークンを検証し、検証済みメールをホワイトリスト照合。
 *   - 追加のOAuth設定（リダイレクトURI登録）は不要。承認済みJavaScript生成元のみでOK。
 *   - デモ: Googleなしで自動ログイン。
 */
window.Auth = (function () {
  var C = window.CONFIG;
  var state = { token: '', exp: 0, user: null };
  var changeCb = null;
  var tokenClient = null;
  var LS = 'mycar.auth';

  function setOnChange(fn) { changeCb = fn; }

  async function init() {
    if (C.DEMO_MODE) {
      state.user = { email: 'kyantyome@gmail.com', name: 'kyan', picture: '' };
      state.token = 'demo';
      state.exp = Date.now() + 3600e3;
      return;
    }
    // 保存済みトークンを復元（有効期限内なら）
    try {
      var s = JSON.parse(sessionStorage.getItem(LS) || localStorage.getItem(LS) || 'null');
      if (s && s.exp > Date.now() + 30000) { state.token = s.token; state.exp = s.exp; state.user = s.user || null; }
    } catch (e) {}

    await loadGis();
    if (window.google && window.google.accounts && window.google.accounts.oauth2 && C.GOOGLE_CLIENT_ID) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: C.GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: function (resp) {
          if (resp && resp.access_token) {
            state.token = resp.access_token;
            state.exp = Date.now() + (Number(resp.expires_in || 3600) * 1000);
            persist();
            if (changeCb) changeCb();
          }
        },
        error_callback: function (err) {
          // ポップアップ閉じ・拒否など。ログイン画面のまま。
          if (window.console) console.warn('OAuth error:', err && err.type);
        }
      });
    }
  }

  function persist() {
    var data = JSON.stringify({ token: state.token, exp: state.exp, user: state.user });
    try { sessionStorage.setItem(LS, data); localStorage.setItem(LS, data); } catch (e) {}
  }

  function loadGis() {
    return new Promise(function (res) {
      if (window.google && window.google.accounts) return res();
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      s.onload = function () { res(); };
      s.onerror = function () { res(); };
      document.head.appendChild(s);
    });
  }

  // ログインを開始（ユーザー操作から呼ぶこと＝ポップアップ要件）
  function signIn() {
    if (!tokenClient) { alert('ログインを初期化できません。GOOGLE_CLIENT_ID の設定とネット接続を確認してください。'); return; }
    tokenClient.requestAccessToken({ prompt: state.user ? '' : 'select_account' });
  }

  // ログイン画面のボタンを描画
  function renderButton(container) {
    if (!C.GOOGLE_CLIENT_ID) {
      container.innerHTML = '<div class="login-err">GOOGLE_CLIENT_ID が未設定です（config.js）。</div>';
      return;
    }
    container.innerHTML = '<button type="button" class="gsign"><span class="gsign-g">G</span>Google でログイン</button>';
    container.querySelector('.gsign').onclick = signIn;
  }

  function signedIn() { return !!state.token && state.exp > Date.now(); }
  function token() { return state.token; }
  function user() { return state.user; }
  function setUser(u) { if (u) { state.user = u; persist(); } }

  function signOut() {
    try {
      if (state.token && state.token !== 'demo' && window.google && window.google.accounts && window.google.accounts.oauth2) {
        window.google.accounts.oauth2.revoke(state.token, function () {});
      }
    } catch (e) {}
    state.token = ''; state.exp = 0; state.user = null;
    try { sessionStorage.removeItem(LS); localStorage.removeItem(LS); } catch (e) {}
  }

  return {
    init: init, setOnChange: setOnChange, renderButton: renderButton, signIn: signIn,
    signedIn: signedIn, token: token, user: user, setUser: setUser, signOut: signOut,
    isDemo: function () { return !!C.DEMO_MODE; }
  };
})();
