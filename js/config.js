/**
 * アプリ設定。デプロイ後にここを書き換える。
 *   DEMO_MODE=true … バックエンド無しでデモデータ動作（プレビュー/開発用）
 *   本番運用時は DEMO_MODE=false にして API_BASE と APP_TOKEN を設定する。
 * self を使うことで、ページと Service Worker（importScripts）の両方から参照できる。
 */
self.CONFIG = {
  DEMO_MODE: false,
  API_BASE: 'https://script.google.com/macros/s/AKfycbzhEUyc-WxFu14qL3Sb5MK31gzEOwwXRPLqcsBGnt9wsJczOhoWPbo-7JZcZ7dzlBAZ/exec',
  APP_TOKEN: 'SF012345678901472583690369258147',
  GOOGLE_CLIENT_ID: '228351172126-ie0ldvpicto23nntr06oqnrfaft8t0vu.apps.googleusercontent.com',
  APP_NAME: 'MYCAR·CONSOLE'
};
