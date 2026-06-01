/**
 * アプリ設定。デプロイ後にここを書き換える。
 *   DEMO_MODE=true … バックエンド無しでデモデータ動作（プレビュー/開発用）
 *   本番運用時は DEMO_MODE=false にして API_BASE と APP_TOKEN を設定する。
 * self を使うことで、ページと Service Worker（importScripts）の両方から参照できる。
 */
self.CONFIG = {
  DEMO_MODE: true,
  API_BASE: '',                 // 例: 'https://script.google.com/macros/s/XXXX/exec'
  APP_TOKEN: '',                // GAS の Script Property APP_TOKEN と一致させる（公開系API/通知取得用）
  GOOGLE_CLIENT_ID: '',         // Google Cloud の OAuth クライアントID（Web）。Sign-In に使用
  APP_NAME: 'MYCAR·CONSOLE'
};
