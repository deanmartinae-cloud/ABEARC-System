const TELEGRAM_API_BASE_URL = String(process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org').replace(/\/+$/, '');
// NAS connections can need more than Node's short IPv4/IPv6 attempt window.
require('node:net').setDefaultAutoSelectFamilyAttemptTimeout(2000);
let TELEGRAM_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const TELEGRAM_POLL_TIMEOUT_SECONDS = Math.max(5, Math.min(50, Number(process.env.TELEGRAM_POLL_TIMEOUT_SECONDS || 25) || 25));
const TELEGRAM_REQUEST_TIMEOUT_MS = Math.max(10000, Math.min(120000, Number(process.env.TELEGRAM_REQUEST_TIMEOUT_MS || 40000) || 40000));
const TELEGRAM_DELIVERY_BATCH_SIZE = Math.max(1, Math.min(50, Number(process.env.TELEGRAM_DELIVERY_BATCH_SIZE || 20) || 20));
const TELEGRAM_REGISTRATION_CODE_TTL_MINUTES = Math.max(2, Math.min(60, Number(process.env.TELEGRAM_REGISTRATION_CODE_TTL_MINUTES || 10) || 10));
const TELEGRAM_MAX_RETRY_COUNT = Math.max(1, Math.min(20, Number(process.env.TELEGRAM_MAX_RETRY_COUNT || 8) || 8));
const TELEGRAM_DEFAULT_PARSE_MODE = 'HTML';
