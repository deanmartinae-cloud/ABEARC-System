const WEATHER_PROVIDER = String(process.env.WEATHER_PROVIDER || 'zentra').trim().toLowerCase();
const ZENTRA_API_BASE_URL = String(process.env.ZENTRA_API_BASE_URL || 'https://api.zentracloud.io/v5').replace(/\/+$/, '');
let ZENTRA_API_KEY = String(process.env.ZENTRA_API_KEY || '').trim();
const WEATHER_DEFAULT_TIMEZONE = String(process.env.WEATHER_DEFAULT_TIMEZONE || 'Asia/Manila').trim() || 'Asia/Manila';
const WEATHER_SYNC_INTERVAL_MINUTES = Math.max(5, Math.min(1440, Number(process.env.WEATHER_SYNC_INTERVAL_MINUTES || 15) || 15));
const WEATHER_DISCOVERY_INTERVAL_MINUTES = Math.max(15, Math.min(10080, Number(process.env.WEATHER_DISCOVERY_INTERVAL_MINUTES || 60) || 60));
const WEATHER_REQUEST_TIMEOUT_MS = Math.max(5000, Math.min(120000, Number(process.env.WEATHER_REQUEST_TIMEOUT_MS || 30000) || 30000));
const WEATHER_ALERT_COOLDOWN_MINUTES = Math.max(15, Math.min(10080, Number(process.env.WEATHER_ALERT_COOLDOWN_MINUTES || 180) || 180));
const WEATHER_MAX_HISTORY_ROWS = Math.max(5000, Math.min(250000, Number(process.env.WEATHER_MAX_HISTORY_ROWS || 100000) || 100000));
const WEATHER_MAX_EXPORT_ROWS = Math.max(10000, Math.min(500000, Number(process.env.WEATHER_MAX_EXPORT_ROWS || 250000) || 250000));
const WEATHER_PROVIDER_LABELS = Object.freeze({ zentra: 'ZENTRA Cloud' });

// ABEARC-managed API credentials: AES-256-GCM in the persistent /data volume.
// A random local key is created automatically and never sent to the browser.
// Back up the credential key and encrypted credential together; losing the key
// prevents recovery of the API token. Environment configuration remains supported.
const WEATHER_CREDENTIAL_FILE = path.join(DATA_DIR, '.weather-credential.enc');
const WEATHER_CREDENTIAL_KEY_FILE = path.join(DATA_DIR, '.weather-credential.key');
const weatherCredentialKey = () => {
  fs.mkdirSync(DATA_DIR, {recursive:true});
  if (!fs.existsSync(WEATHER_CREDENTIAL_KEY_FILE)) {
    try { fs.writeFileSync(WEATHER_CREDENTIAL_KEY_FILE, crypto.randomBytes(32), {mode:0o600,flag:'wx'}); }
    catch (e) { if(e.code!=='EEXIST') throw e; }
  }
  const key=fs.readFileSync(WEATHER_CREDENTIAL_KEY_FILE);
  if(key.length!==32) throw new Error('Weather credential encryption key is invalid.');
  return key;
};
const weatherReadApiCredential = () => {
  if(!fs.existsSync(WEATHER_CREDENTIAL_FILE)) return '';
  const envelope=JSON.parse(fs.readFileSync(WEATHER_CREDENTIAL_FILE,'utf8'));
  if(envelope.version!==1) throw new Error('Unsupported weather credential format.');
  const decipher=crypto.createDecipheriv('aes-256-gcm',weatherCredentialKey(),Buffer.from(envelope.iv,'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]).toString('utf8');
};
const weatherWriteApiCredential = value => {
  const key=weatherCredentialKey(),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const ciphertext=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
  const envelope=JSON.stringify({version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:ciphertext.toString('base64')});
  const temporary=WEATHER_CREDENTIAL_FILE+'.tmp-'+process.pid;
  fs.writeFileSync(temporary,envelope,{mode:0o600,flag:'w'});
  fs.renameSync(temporary,WEATHER_CREDENTIAL_FILE);
};
try {
  const stored=weatherReadApiCredential();
  if(stored) ZENTRA_API_KEY=stored;
} catch (error) { console.error('[WEATHER] Cannot decrypt stored ZENTRA key: '+error.message); }
const weatherApiKeyConfigured = () => Boolean(ZENTRA_API_KEY);
