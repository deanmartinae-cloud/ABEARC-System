// Store bot tokens using the same AES-256-GCM pattern as weather credentials.
const TELEGRAM_CREDENTIAL_FILE = path.join(DATA_DIR, '.telegram-credential.enc');
const TELEGRAM_CREDENTIAL_KEY_FILE = path.join(DATA_DIR, '.telegram-credential.key');
const telegramCredentialKey = () => {
  fs.mkdirSync(DATA_DIR, {recursive:true});
  if (!fs.existsSync(TELEGRAM_CREDENTIAL_KEY_FILE)) {
    try { fs.writeFileSync(TELEGRAM_CREDENTIAL_KEY_FILE, crypto.randomBytes(32), {mode:0o600,flag:'wx'}); }
    catch (e) { if(e.code!=='EEXIST') throw e; }
  }
  const key=fs.readFileSync(TELEGRAM_CREDENTIAL_KEY_FILE);
  if(key.length!==32) throw new Error('Telegram credential encryption key is invalid.');
  return key;
};
const telegramReadBotCredential = () => {
  if(!fs.existsSync(TELEGRAM_CREDENTIAL_FILE)) return '';
  const envelope=JSON.parse(fs.readFileSync(TELEGRAM_CREDENTIAL_FILE,'utf8'));
  if(envelope.version!==1) throw new Error('Unsupported Telegram credential format.');
  const decipher=crypto.createDecipheriv('aes-256-gcm',telegramCredentialKey(),Buffer.from(envelope.iv,'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]).toString('utf8');
};
const telegramWriteBotCredential = value => {
  const key=telegramCredentialKey(),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const ciphertext=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
  const envelope=JSON.stringify({version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:ciphertext.toString('base64')});
  const temporary=TELEGRAM_CREDENTIAL_FILE+'.tmp-'+process.pid;
  fs.writeFileSync(temporary,envelope,{mode:0o600,flag:'w'});
  fs.renameSync(temporary,TELEGRAM_CREDENTIAL_FILE);
};
try {
  const stored=telegramReadBotCredential();
  if(stored) TELEGRAM_BOT_TOKEN=stored;
} catch (error) { console.error('[TELEGRAM] Cannot decrypt stored bot token: '+error.message); }
