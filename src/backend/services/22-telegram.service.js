class TelegramApiError extends Error {
  constructor(message, { statusCode = 502, errorCode = null, retryAfter = null, permanent = false } = {}) {
    super(message);
    this.name = 'TelegramApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.retryAfter = retryAfter;
    this.permanent = permanent;
  }
}

let telegramPollingActive = false;
let telegramSchedulerActive = false;
let telegramDeliveryProcessing = false;
let telegramDeliveryTimer = null;
let telegramWeatherTimer = null;
let telegramPollPromise = null;
let telegramPollController = null;
let telegramStartupTimer = null;

const telegramNowIso = () => new Date().toISOString();
const telegramSleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const telegramEscapeHtml = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const telegramJsonParse = (value, fallback = {}) => { try { return JSON.parse(String(value || '')); } catch (_) { return fallback; } };
const telegramCodeHash = code => crypto.createHash('sha256').update(String(code || '').trim().toUpperCase()).digest('hex');
const telegramStateGet = async key => (await dbGet(`SELECT setting_value FROM TelegramSystemState WHERE setting_key=?`, [key]))?.setting_value ?? null;
const telegramStateSet = async (key, value) => dbRun(`INSERT INTO TelegramSystemState(setting_key,setting_value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=CURRENT_TIMESTAMP`, [key, String(value ?? '')]);

const telegramApiRequest = async (method, body = {}, { timeoutMs = TELEGRAM_REQUEST_TIMEOUT_MS, token = TELEGRAM_BOT_TOKEN } = {}) => {
  if (!token) throw new TelegramApiError('Telegram bot token is not configured on the ABEARC server.', { statusCode: 503, errorCode: 'TELEGRAM_TOKEN_NOT_CONFIGURED', permanent: true });
  const controller = new AbortController();
  if(method==='getUpdates')telegramPollController=controller;
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  let response;
  try {
    response = await fetch(`${TELEGRAM_API_BASE_URL}/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body || {}), signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new TelegramApiError('Telegram request timed out.', { statusCode: 504 });
    const codes=[...new Set([error?.cause?.code,error?.code,...(error?.cause?.errors||[]).map(e=>e.code)].filter(code=>typeof code==='string'&&/^[A-Z][A-Z0-9_]{1,50}$/.test(code)))];
    throw new TelegramApiError(`Telegram network request failed${codes.length?` (${codes.join(', ')})`:''}. Check the server internet connection.`, { statusCode: 502 });
  } finally { clearTimeout(timeout);if(telegramPollController===controller)telegramPollController=null; }
  let payload = null;
  try { payload = await response.json(); } catch (_) {}
  if (!response.ok || !payload?.ok) {
    const code = Number(payload?.error_code || response.status || 502);
    const retryAfter = Number(payload?.parameters?.retry_after || 0) || null;
    const description = String(payload?.description || `Telegram API HTTP ${response.status}`).replaceAll(token,'[redacted]');
    throw new TelegramApiError(description.slice(0,500), { statusCode: code === 429 ? 429 : 502, errorCode: code, retryAfter, permanent: code === 400 || code === 401 || code === 403 || code === 404 });
  }
  return payload.result;
};

const telegramGetBotIdentity = async () => {
  const me = await telegramApiRequest('getMe');
  await telegramStateSet('bot_username', me?.username || '');
  await telegramStateSet('bot_id', me?.id ?? '');
  return me;
};

const telegramPublicTarget = target => ({
  id:Number(target.id), chat_id:String(target.chat_id), chat_type:target.chat_type, title:target.title||'', username:target.username||'', active:Boolean(target.active),
  approved_at:target.approved_at||null,last_seen_at:target.last_seen_at||null,created_at:target.created_at||null,updated_at:target.updated_at||null
});

const telegramUpsertTargetFromChat = async ({ chat, from = null, approvedByUserId = null, registrationCodeId = null }) => {
  const chatId = String(chat?.id ?? '').trim();
  if (!chatId) throw new Error('Telegram chat ID is missing.');
  const title = String(chat?.title || [chat?.first_name, chat?.last_name].filter(Boolean).join(' ') || chat?.username || `Telegram ${chatId}`).slice(0,200);
  const type = String(chat?.type || 'unknown').slice(0,32);
  await dbRun(`INSERT INTO TelegramTargets(chat_id,chat_type,title,username,active,registered_by_telegram_user_id,approved_by_user_id,approved_at,last_seen_at,metadata_json)
    VALUES(?,?,?,?,1,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?)
    ON CONFLICT(chat_id) DO UPDATE SET chat_type=excluded.chat_type,title=excluded.title,username=excluded.username,active=1,
      registered_by_telegram_user_id=COALESCE(excluded.registered_by_telegram_user_id,TelegramTargets.registered_by_telegram_user_id),
      approved_by_user_id=COALESCE(excluded.approved_by_user_id,TelegramTargets.approved_by_user_id),approved_at=COALESCE(TelegramTargets.approved_at,CURRENT_TIMESTAMP),
      last_seen_at=CURRENT_TIMESTAMP,metadata_json=excluded.metadata_json,updated_at=CURRENT_TIMESTAMP`, [chatId,type,title,chat?.username||null,from?.id?String(from.id):null,approvedByUserId,JSON.stringify({chat})]);
  if (registrationCodeId) await dbRun(`UPDATE TelegramRegistrationCodes SET used_at=CURRENT_TIMESTAMP,used_chat_id=? WHERE id=? AND used_at IS NULL`, [chatId, registrationCodeId]);
  return dbGet(`SELECT * FROM TelegramTargets WHERE chat_id=?`, [chatId]);
};

const telegramGenerateRegistrationCode = async userId => {
  await dbRun(`DELETE FROM TelegramRegistrationCodes WHERE used_at IS NOT NULL OR expires_at < CURRENT_TIMESTAMP`);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i=0;i<8;i+=1) code += alphabet[bytes[i] % alphabet.length];
  const expiresAt = new Date(Date.now() + TELEGRAM_REGISTRATION_CODE_TTL_MINUTES*60000).toISOString();
  await dbRun(`INSERT INTO TelegramRegistrationCodes(code_hash,expires_at,created_by_user_id) VALUES(?,?,?)`, [telegramCodeHash(code),expiresAt,userId||null]);
  return { code, expires_at: expiresAt, command: `/abearc_register ${code}` };
};

const telegramFindRegistrationCode = async code => dbGet(`SELECT * FROM TelegramRegistrationCodes WHERE code_hash=? AND used_at IS NULL AND expires_at>=? ORDER BY id DESC LIMIT 1`, [telegramCodeHash(code), telegramNowIso()]);

const telegramSendText = async (chatId, text, { parseMode = TELEGRAM_DEFAULT_PARSE_MODE, disablePreview = true } = {}) => {
  const payload = { chat_id:String(chatId), text:String(text||'').slice(0,4096), disable_web_page_preview:Boolean(disablePreview), allow_paid_broadcast:false };
  if (parseMode) payload.parse_mode = parseMode;
  return telegramApiRequest('sendMessage', payload);
};

const telegramQueueMessage = async ({ targetId, kind, sourceKey, text, parseMode = TELEGRAM_DEFAULT_PARSE_MODE }) => {
  const cleanText = String(text || '').trim();
  if (!cleanText) return { queued:false, reason:'empty' };
  const result = await dbRun(`INSERT OR IGNORE INTO TelegramDeliveries(target_id,kind,source_key,message_text,parse_mode,status) VALUES(?,?,?,?,?,'queued')`, [targetId,String(kind||'message'),String(sourceKey||crypto.randomUUID()),cleanText,String(parseMode||'')]);
  return { queued: result.changes > 0 };
};

const telegramDeliveryRetryDelaySeconds = (attempt, retryAfter = null) => {
  if (Number.isFinite(Number(retryAfter)) && Number(retryAfter)>0) return Math.min(3600, Number(retryAfter)+1);
  return Math.min(3600, Math.max(10, 15 * Math.pow(2, Math.min(7, Math.max(0, Number(attempt||0))))));
};

const telegramProcessDeliveryQueue = async () => {
  if (!TELEGRAM_BOT_TOKEN) return { processed:0 };
  if (telegramDeliveryProcessing) return { processed:0, busy:true };
  telegramDeliveryProcessing=true;
  try {
    const rows = await dbAll(`SELECT d.*,t.chat_id,t.active AS target_active FROM TelegramDeliveries d JOIN TelegramTargets t ON t.id=d.target_id
      WHERE d.status IN ('queued','retry') AND (d.next_attempt_at IS NULL OR d.next_attempt_at<=CURRENT_TIMESTAMP)
      ORDER BY d.created_at,d.id LIMIT ?`, [TELEGRAM_DELIVERY_BATCH_SIZE]);
    let processed=0;
    for (const delivery of rows) {
      if (!delivery.target_active) {
        await dbRun(`UPDATE TelegramDeliveries SET status='skipped',last_error='Target is disabled.',updated_at=CURRENT_TIMESTAMP WHERE id=?`,[delivery.id]);
        continue;
      }
      try {
        const sent = await telegramSendText(delivery.chat_id, delivery.message_text, { parseMode:delivery.parse_mode || null });
        await dbRun(`UPDATE TelegramDeliveries SET status='sent',attempt_count=attempt_count+1,next_attempt_at=NULL,last_error=NULL,telegram_message_id=?,telegram_sent_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [sent?.message_id==null?null:String(sent.message_id), telegramNowIso(), delivery.id]);
        await telegramStateSet('last_delivery_at', telegramNowIso());
        processed+=1;
      } catch (error) {
        const attempts = Number(delivery.attempt_count||0)+1;
        const permanent = Boolean(error?.permanent) || attempts >= TELEGRAM_MAX_RETRY_COUNT;
        const next = permanent ? null : new Date(Date.now()+telegramDeliveryRetryDelaySeconds(attempts,error?.retryAfter)*1000).toISOString();
        await dbRun(`UPDATE TelegramDeliveries SET status=?,attempt_count=?,next_attempt_at=?,last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [permanent?'failed':'retry',attempts,next,String(error?.message||'Telegram delivery failed.').slice(0,1000),delivery.id]);
        if (Number(error?.errorCode)===403) await dbRun(`UPDATE TelegramTargets SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[delivery.target_id]);
      }
    }
    return { processed };
  } finally {
    telegramDeliveryProcessing=false;
  }
};

const telegramFormatWeatherAlert = ({ station, event, rule, resolved = false }) => {
  const title = resolved ? '✅ <b>ABEARC Weather Alert Cleared</b>' : '⚠️ <b>ABEARC Weather Alert</b>';
  const statusLine = resolved ? 'The previously detected condition is no longer active.' : telegramEscapeHtml(event.message || 'Weather alert condition detected.');
  return `${title}\n\n<b>Station:</b> ${telegramEscapeHtml(station.display_name || station.source_name || `Station ${station.id}`)}\n<b>Alert:</b> ${telegramEscapeHtml(rule.label || String(rule.alert_type||'Weather alert').replace(/_/g,' '))}\n<b>Status:</b> ${resolved?'Resolved':'Active'}\n\n${statusLine}\n\n<i>Generated automatically by ABEARC from the connected weather station.</i>`;
};

const telegramQueueWeatherAlerts = async () => {
  if (!TELEGRAM_BOT_TOKEN) return;
  const rows = await dbAll(`SELECT e.*,r.alert_type,r.label AS rule_label,wr.id AS telegram_route_id,wr.target_id,wr.send_resolved,wr.created_at AS route_created_at,s.display_name,s.source_name
    FROM WeatherAlertEvents e JOIN WeatherAlertRules r ON r.id=e.rule_id JOIN TelegramWeatherRoutes wr ON wr.rule_id=e.rule_id AND wr.enabled=1
    JOIN TelegramTargets t ON t.id=wr.target_id AND t.active=1 JOIN WeatherStations s ON s.id=e.station_id
    WHERE e.status IN ('active','resolved') ORDER BY e.updated_at DESC LIMIT 1000`);
  for (const row of rows) {
    const state=await dbGet(`SELECT * FROM TelegramWeatherRouteState WHERE route_id=? AND alert_event_id=?`,[row.telegram_route_id,row.id]);
    const status=String(row.status||'');
    if(status==='active' && state?.last_status!=='active'){
      const seq=Number(state?.transition_seq||0)+1;
      await telegramQueueMessage({targetId:row.target_id,kind:'weather_alert',sourceKey:`weather-route:${row.telegram_route_id}:event:${row.id}:transition:${seq}:active`,text:telegramFormatWeatherAlert({station:row,event:row,rule:{alert_type:row.alert_type,label:row.rule_label},resolved:false})});
      await dbRun(`INSERT INTO TelegramWeatherRouteState(route_id,alert_event_id,last_status,transition_seq,last_event_updated_at,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(route_id,alert_event_id) DO UPDATE SET last_status=excluded.last_status,transition_seq=excluded.transition_seq,last_event_updated_at=excluded.last_event_updated_at,updated_at=CURRENT_TIMESTAMP`,[row.telegram_route_id,row.id,'active',seq,row.updated_at||null]);
    } else if(status==='resolved'){
      if(!state){
        // A route created after an already-resolved event should establish a baseline,
        // not emit a stale "cleared" message that the target never saw as active.
        await dbRun(`INSERT OR IGNORE INTO TelegramWeatherRouteState(route_id,alert_event_id,last_status,transition_seq,last_event_updated_at) VALUES(?,?,?,?,?)`,[row.telegram_route_id,row.id,'resolved',0,row.updated_at||row.resolved_at||null]);
        continue;
      }
      if(state.last_status==='active'){
        const seq=Number(state.transition_seq||0)+1;
        if(Boolean(row.send_resolved)) await telegramQueueMessage({targetId:row.target_id,kind:'weather_alert_resolved',sourceKey:`weather-route:${row.telegram_route_id}:event:${row.id}:transition:${seq}:resolved`,text:telegramFormatWeatherAlert({station:row,event:row,rule:{alert_type:row.alert_type,label:row.rule_label},resolved:true})});
        await dbRun(`UPDATE TelegramWeatherRouteState SET last_status='resolved',transition_seq=?,last_event_updated_at=?,updated_at=CURRENT_TIMESTAMP WHERE route_id=? AND alert_event_id=?`,[seq,row.updated_at||row.resolved_at||null,row.telegram_route_id,row.id]);
      }
    }
  }
};

const telegramLocalParts = (date, timezone) => {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:timezone||WEATHER_DEFAULT_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const out={}; parts.forEach(p=>{if(p.type!=='literal')out[p.type]=p.value;});
  const dowMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  return {year:Number(out.year),month:Number(out.month),day:Number(out.day),hour:Number(out.hour),minute:Number(out.minute),dow:dowMap[out.weekday]??0,dateKey:`${out.year}-${out.month}-${out.day}`};
};
const telegramLocalDateKey = (year,month,day) => {
  const d=new Date(Date.UTC(Number(year),Number(month)-1,Number(day)));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
};

const telegramWeatherReportText = async (station, frequency='daily') => {
  const now=Math.floor(Date.now()/1000),days=frequency==='monthly'?31:(frequency==='weekly'?7:1);
  const timezone=station.timezone||WEATHER_DEFAULT_TIMEZONE;
  const date=ts=>new Date(ts*1000).toLocaleString('en-PH',{timeZone:timezone,month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
  const numeric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const current = await weatherCurrentConditions(station);
  const rain = await weatherRainTotals(station);
  const byKey = new Map(current.readings.map(r=>[r.normalized_key,r]));
  const val = (key,digits=1) => { const r=byKey.get(key); return r && numeric(r.value) && (!r.quality_status||r.quality_status==='valid') ? `${Number(r.value).toFixed(digits)}${r.unit?` ${telegramEscapeHtml(r.unit)}`:''}` : 'Unavailable'; };
  const status=String(current.health?.status||current.health?.label||'unknown').toLowerCase();
  const latest=Number(current.station?.last_measurement_ts||station.last_measurement_ts||Math.max(0,...current.readings.map(r=>Number(r.timestamp_utc)||0)));
  const age=latest>0?Math.max(0,Math.floor((now-latest)/60)):null;
  const ageLabel=age===null?'age unknown':age<60?`${age} min ago`:age<1440?`${Math.floor(age/60)} h ${age%60} min ago`:`${Math.floor(age/1440)} day(s) ago`;
  const agri = await weatherDailyAgriculture({station,startTs:now-days*86400,endTs:now+1,gddBaseC:10});
  const validRain=agri.map(x=>x.rainfall_mm).filter(numeric).map(Number);
  const temps=agri.flatMap(x=>[x.temperature_min_c,x.temperature_max_c]).filter(numeric).map(Number);
  const et0=agri.map(x=>x.et0_mm).filter(numeric).map(Number);
  const periodRain=validRain.length?validRain.reduce((a,b)=>a+b,0):null;
  const periodEt0=et0.length?et0.reduce((a,b)=>a+b,0):null;
  const label=frequency==='monthly'?'Monthly':(frequency==='weekly'?'Weekly':'Daily');
  const lines=[`🌦️ <b>ABEARC ${label} Weather Report</b>`,'',`<b>Station:</b> ${telegramEscapeHtml(station.display_name||station.source_name||`Station ${station.id}`)}`,`<b>Station health:</b> ${telegramEscapeHtml(current.health?.label||current.health?.status||'Unknown')}`,`<b>Generated:</b> ${date(now)} (${telegramEscapeHtml(timezone)})`,`<b>Last measurement:</b> ${latest>0?date(latest):'Unavailable'} · ${ageLabel}`];
  if(status!=='online')lines.push('',`⚠️ <b>Station data need attention.</b> These are cached readings, not live conditions. Check station connectivity and synchronization.`);
  lines.push('',`<b>Current conditions (as of ${latest>0?date(latest):'measurement time unavailable'})</b>`,`Temperature: ${val('air_temperature')}`,`Relative humidity: ${val('relative_humidity')}`,`Wind: ${val('wind_speed')}`,`Wind gust: ${val('wind_gust')}`,`Rain intensity: ${val('rain_rate')}`);
  const totals=v=>numeric(v)?`${Number(v).toFixed(1)} mm`:'Unavailable';
  lines.push('',`<b>Recorded rainfall</b>`,`Last 24 h: ${totals(rain.last_24h_mm)}`,`Last 7 days: ${totals(rain.last_7d_mm)}`);
  lines.push('',`<b>Period summary · rolling ${days===1?'24 hours':days+' days'}</b>`,`${date(now-days*86400)} → ${date(now)}`,`Recorded rainfall: ${totals(periodRain)}`,`Temperature range: ${temps.length?`${Math.min(...temps).toFixed(1)}–${Math.max(...temps).toFixed(1)} °C`:'Unavailable'}`,`Reference ET₀ (available daily values): ${totals(periodEt0)}`);
  lines.push('',`<i>Totals use available samples and may be partial. Zero recorded rainfall does not confirm no rain during missing periods. Reference ET₀ is not a crop irrigation requirement.</i>`, '',`<i>Generated automatically by ABEARC from Local automated weather station observations.</i>`);
  return lines.join('\n');
};

const telegramQueueScheduledReports = async () => {
  if (!TELEGRAM_BOT_TOKEN) return;
  const schedules = await dbAll(`SELECT rs.*,s.display_name,s.source_name,s.timezone,s.id AS weather_station_id,t.active AS target_active FROM TelegramReportSchedules rs JOIN WeatherStations s ON s.id=rs.station_id JOIN TelegramTargets t ON t.id=rs.target_id WHERE rs.enabled=1 AND t.active=1`);
  const now=new Date();
  for(const schedule of schedules){
    const p=telegramLocalParts(now,schedule.timezone||WEATHER_DEFAULT_TIMEZONE);
    const timePassed=p.hour>Number(schedule.send_hour)||(p.hour===Number(schedule.send_hour)&&p.minute>=Number(schedule.send_minute));
    if(!timePassed) continue;
    let due=false,runKey='';
    if(schedule.frequency==='daily'){runKey=`daily:${p.dateKey}`;due=timePassed;}
    else if(schedule.frequency==='weekly'){
      const scheduledDow=Math.max(0,Math.min(6,Number(schedule.day_of_week??1)));
      const weekStartKey=telegramLocalDateKey(p.year,p.month,p.day-p.dow);
      runKey=`weekly:${weekStartKey}`;
      due=p.dow>scheduledDow||(p.dow===scheduledDow&&timePassed);
    }
    else if(schedule.frequency==='monthly'){
      const scheduledDay=Math.max(1,Math.min(28,Number(schedule.day_of_month||1)));
      runKey=`monthly:${p.year}-${String(p.month).padStart(2,'0')}`;
      due=p.day>scheduledDay||(p.day===scheduledDay&&timePassed);
    }
    if(!due||schedule.last_run_key===runKey) continue;
    const station=await dbGet(`SELECT * FROM WeatherStations WHERE id=?`,[schedule.station_id]);
    if(!station) continue;
    const text=await telegramWeatherReportText(station,schedule.frequency);
    const queued=await telegramQueueMessage({targetId:schedule.target_id,kind:'weather_report',sourceKey:`schedule:${schedule.id}:${runKey}`,text});
    if(queued.queued||schedule.last_run_key!==runKey) await dbRun(`UPDATE TelegramReportSchedules SET last_run_key=?,last_run_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[runKey,schedule.id]);
  }
};

const telegramHandleCommand = async update => {
  const message=update?.message||update?.channel_post||null;
  if(!message?.chat) return;
  const text=String(message.text||'').trim();
  const commandToken=text.split(/\s+/)[0]||'';
  const command=commandToken.replace(/@[^\s]+$/,'').toLowerCase();
  const bareCode=/^[A-Z2-9]{8}$/i.test(text);
  if(!command.startsWith('/')&&!bareCode) return;
  const args=text.split(/\s+/).slice(1);
  const chat=message.chat,from=message.from||null,chatId=String(chat.id);
  if(command==='/abearc_register'||bareCode){
    const code=bareCode?text:args[0]||'';
    const registration=await telegramFindRegistrationCode(code);
    if(!registration){await telegramSendText(chatId,'❌ This ABEARC registration code is invalid, expired, or already used.',{parseMode:null});return;}
    const target=await telegramUpsertTargetFromChat({chat,from,approvedByUserId:registration.created_by_user_id,registrationCodeId:registration.id});
    await telegramSendText(chatId,`✅ <b>ABEARC connected</b>\n\nThis ${telegramEscapeHtml(target.chat_type)} is now registered as <b>${telegramEscapeHtml(target.title)}</b>. An ABEARC administrator can assign weather alerts and scheduled reports to it.`);
    return;
  }
  const target=await dbGet(`SELECT * FROM TelegramTargets WHERE chat_id=? AND active=1`,[chatId]);
  if(!target){
    if(['/start','/help','/abearc_help'].includes(command))await telegramSendText(chatId,'Welcome to ABEARC Weather Alerts. In ABEARC, open Settings → Telegram Integration and generate a registration code. Send the complete /abearc_register CODE command here to connect this chat.',{parseMode:null});
    return;
  }
  await dbRun(`UPDATE TelegramTargets SET last_seen_at=CURRENT_TIMESTAMP,title=?,username=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[String(chat.title||target.title||'').slice(0,200),chat.username||null,target.id]);
  if(command==='/weather'){
    const station=await dbGet(`SELECT * FROM WeatherStations WHERE enabled=1 ORDER BY display_name,id LIMIT 1`);
    if(!station){await telegramSendText(chatId,'No enabled ABEARC weather station is available yet.',{parseMode:null});return;}
    await telegramSendText(chatId,await telegramWeatherReportText(station,'daily'));
  } else if(command==='/abearc_help'||command==='/help'||command==='/start'){
    await telegramSendText(chatId,'<b>ABEARC Telegram</b>\n\nAvailable command:\n/weather — current weather summary from the first enabled station\n\nWeather alerts and scheduled reports are configured by an authorized ABEARC administrator.');
  }
};

const telegramProcessUpdate = async update => {
  try { await telegramHandleCommand(update); }
  catch(error){ logError('TELEGRAM_UPDATE_FAILED',String(error?.message||error),error?.stack); }
};

const telegramPollingLoop = async () => {
  if(telegramPollingActive||!TELEGRAM_BOT_TOKEN) return;
  telegramPollingActive=true;
  try{
    try{await telegramApiRequest('deleteWebhook',{drop_pending_updates:false});}catch(error){logError('TELEGRAM_DELETE_WEBHOOK_FAILED',error.message,error.stack);}
    try{await telegramGetBotIdentity();}catch(error){await telegramStateSet('last_poll_error',error.message);throw error;}
    while(telegramPollingActive){
      let offset=Number(await telegramStateGet('update_offset')||0)||0;
      try{
        const updates=await telegramApiRequest('getUpdates',{offset,timeout:TELEGRAM_POLL_TIMEOUT_SECONDS,allowed_updates:['message','channel_post','my_chat_member']},{timeoutMs:(TELEGRAM_POLL_TIMEOUT_SECONDS*1000)+TELEGRAM_REQUEST_TIMEOUT_MS});
        await telegramStateSet('last_poll_at',telegramNowIso()); await telegramStateSet('last_poll_error','');
        for(const update of Array.isArray(updates)?updates:[]){
          await telegramProcessUpdate(update);
          const next=Number(update?.update_id)+1;
          if(Number.isFinite(next)&&next>offset){offset=next;await telegramStateSet('update_offset',offset);}
        }
      }catch(error){if(!telegramPollingActive)break;await telegramStateSet('last_poll_error',String(error?.message||'Polling failed.').slice(0,1000));logError('TELEGRAM_POLL_FAILED',error.message,error.stack);await telegramSleep(Math.max(5000,(Number(error?.retryAfter)||5)*1000));}
    }
  }finally{telegramPollingActive=false;}
};

const telegramSchedulerTick = async () => {
  if(!TELEGRAM_BOT_TOKEN||telegramSchedulerActive) return;
  telegramSchedulerActive=true;
  try {
    try{await telegramQueueWeatherAlerts();}catch(error){logError('TELEGRAM_WEATHER_ROUTE_FAILED',error.message,error.stack);}
    try{await telegramQueueScheduledReports();}catch(error){logError('TELEGRAM_REPORT_SCHEDULE_FAILED',error.message,error.stack);}
    try{await telegramProcessDeliveryQueue();}catch(error){logError('TELEGRAM_DELIVERY_QUEUE_FAILED',error.message,error.stack);}
  } finally {
    telegramSchedulerActive=false;
  }
};

const startTelegramScheduler = () => {
  if(!TELEGRAM_BOT_TOKEN){console.log('Telegram integration: TELEGRAM_BOT_TOKEN is not configured; Telegram remains disabled.');return;}
  telegramPollPromise=telegramPollingLoop().catch(error=>logError('TELEGRAM_POLLING_STOPPED',error.message,error.stack));
  if(telegramDeliveryTimer) clearInterval(telegramDeliveryTimer);
  telegramDeliveryTimer=setInterval(()=>telegramSchedulerTick().catch(err=>logError('TELEGRAM_SCHEDULER_FAILED',err.message,err.stack)),60*1000);
  telegramStartupTimer=setTimeout(()=>telegramSchedulerTick().catch(err=>logError('TELEGRAM_SCHEDULER_START_FAILED',err.message,err.stack)),3500);
};

const stopTelegramScheduler = async () => {
  clearInterval(telegramDeliveryTimer);clearTimeout(telegramStartupTimer);
  telegramDeliveryTimer=null;telegramStartupTimer=null;
  telegramPollingActive=false;telegramPollController?.abort();
  await telegramPollPromise;
  while(telegramSchedulerActive||telegramDeliveryProcessing)await telegramSleep(50);
};
