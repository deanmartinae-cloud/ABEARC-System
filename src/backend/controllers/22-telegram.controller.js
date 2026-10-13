const telegramParseInt = (value, fallback = null) => {
  const n=Number(value); return Number.isInteger(n)?n:fallback;
};
const telegramBool = (value, fallback=false) => value===undefined?fallback:Boolean(value===true||value===1||String(value).toLowerCase()==='true'||String(value)==='1');
let telegramCredentialSaving=false;
const telegramSaveCredentialController = async (req,res) => {
  if(!['superadmin','system'].includes(req.user?.role))return res.status(403).json({error:'Only superadmin or system admin can change the Telegram bot token.'});
  const token=String(req.body?.bot_token||'').trim();
  if(!/^\d{5,20}:[A-Za-z0-9_-]{20,200}$/.test(token))return res.status(400).json({error:'Enter a valid Telegram bot token from BotFather.'});
  if(telegramCredentialSaving)return res.status(409).json({error:'A Telegram token update is already in progress.'});
  telegramCredentialSaving=true;
  try{
    const me=await telegramApiRequest('getMe',{}, {token});
    telegramWriteBotCredential(token);
    await stopTelegramScheduler();
    TELEGRAM_BOT_TOKEN=token;
    try{
      if(String(await telegramStateGet('bot_id'))!==String(me.id))await telegramStateSet('update_offset','0');
      await telegramStateSet('bot_username',me.username||'');
      await telegramStateSet('bot_id',me.id);
      await telegramStateSet('last_poll_error','');
    }finally{startTelegramScheduler();}
    logActivity({req,action:'TELEGRAM_CREDENTIAL_SAVED',details:'Telegram bot token updated and connection verified.'});
    res.json({success:true,configured:true,bot:{id:me.id,username:me.username||''}});
  }catch(error){res.status(error.statusCode===502?400:error.statusCode||500).json({error:error instanceof TelegramApiError?error.message:'Unable to save Telegram bot token.'});}
  finally{telegramCredentialSaving=false;}
};

const __routeController600 = async (req,res) => {
  try{
    const [botUsername,botId,lastPoll,lastPollError,lastDelivery,targetsCount,queuedCount,failedCount] = await Promise.all([
      telegramStateGet('bot_username'),telegramStateGet('bot_id'),telegramStateGet('last_poll_at'),telegramStateGet('last_poll_error'),telegramStateGet('last_delivery_at'),
      dbGet(`SELECT COUNT(*) count FROM TelegramTargets WHERE active=1`),dbGet(`SELECT COUNT(*) count FROM TelegramDeliveries WHERE status IN ('queued','retry')`),dbGet(`SELECT COUNT(*) count FROM TelegramDeliveries WHERE status='failed'`)
    ]);
    res.json({configured:Boolean(TELEGRAM_BOT_TOKEN),polling_active:Boolean(telegramPollingActive),bot:{id:botId||null,username:botUsername||null},last_poll_at:lastPoll||null,last_poll_error:lastPollError||null,last_delivery_at:lastDelivery||null,active_targets:Number(targetsCount?.count||0),queued_deliveries:Number(queuedCount?.count||0),failed_deliveries:Number(failedCount?.count||0),mode:'long_polling',public_webhook_required:false});
  }catch(error){logError('TELEGRAM_STATUS_FAILED',error.message,error.stack);res.status(500).json({error:'Unable to load Telegram integration status.'});}
};

const __routeController601 = async (req,res) => {
  try{const me=await telegramGetBotIdentity();res.json({ok:true,bot:{id:me.id,username:me.username||null,first_name:me.first_name||'',can_join_groups:Boolean(me.can_join_groups)}});}
  catch(error){res.status(error.statusCode||500).json({error:error.message||'Telegram connection test failed.'});}
};

const __routeController602 = async (req,res) => {
  try{const data=await telegramGenerateRegistrationCode(req.user?.id||null);logActivity({req,action:'TELEGRAM_REGISTRATION_CODE_CREATE',details:'Created a one-time Telegram chat registration code.'});res.json(data);}
  catch(error){logError('TELEGRAM_REGISTRATION_CODE_FAILED',error.message,error.stack);res.status(500).json({error:'Unable to create Telegram registration code.'});}
};

const __routeController603 = async (req,res) => {
  try{const rows=await dbAll(`SELECT * FROM TelegramTargets ORDER BY active DESC, COALESCE(title,''),id`);res.json({targets:rows.map(telegramPublicTarget)});}
  catch(error){res.status(500).json({error:'Unable to load Telegram targets.'});}
};

const __routeController604 = async (req,res) => {
  try{
    const id=telegramParseInt(req.params.id); if(!id)return res.status(400).json({error:'Invalid Telegram target ID.'});
    const existing=await dbGet(`SELECT * FROM TelegramTargets WHERE id=?`,[id]); if(!existing)return res.status(404).json({error:'Telegram target not found.'});
    const active=telegramBool(req.body?.active,Boolean(existing.active));
    const title=String(req.body?.title??existing.title??'').trim().slice(0,200);
    await dbRun(`UPDATE TelegramTargets SET active=?,title=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[active?1:0,title,id]);
    const updated=await dbGet(`SELECT * FROM TelegramTargets WHERE id=?`,[id]);
    logActivity({req,action:'TELEGRAM_TARGET_UPDATE',details:`Telegram target ${id} ${active?'enabled':'disabled'}.`});
    res.json({target:telegramPublicTarget(updated)});
  }catch(error){res.status(500).json({error:'Unable to update Telegram target.'});}
};

const __routeController605 = async (req,res) => {
  try{
    const targetId=telegramParseInt(req.params.id); if(!targetId)return res.status(400).json({error:'Invalid Telegram target ID.'});
    const target=await dbGet(`SELECT * FROM TelegramTargets WHERE id=?`,[targetId]); if(!target)return res.status(404).json({error:'Telegram target not found.'});
    const sourceKey=`manual-test:${req.user?.id||0}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`;
    await telegramQueueMessage({targetId,kind:'manual_test',sourceKey,text:`✅ <b>ABEARC Telegram Test</b>\n\nTelegram delivery is working for <b>${telegramEscapeHtml(target.title||target.chat_id)}</b>.\n\n<i>Sent from ABEARC by ${telegramEscapeHtml(req.user?.username||'an administrator')}.</i>`});
    await telegramProcessDeliveryQueue();
    const delivery=await dbGet(`SELECT * FROM TelegramDeliveries WHERE target_id=? AND kind='manual_test' AND source_key=?`,[targetId,sourceKey]);
    logActivity({req,action:'TELEGRAM_TEST_SEND',details:`Telegram test delivery queued for target ${targetId}.`});
    res.json({delivery});
  }catch(error){res.status(error.statusCode||500).json({error:error.message||'Unable to send Telegram test message.'});}
};

const __routeController606 = async (req,res) => {
  try{
    const rows=await dbAll(`SELECT wr.*,t.title AS target_title,t.chat_id,r.label AS rule_label,r.alert_type,s.display_name AS station_name
      FROM TelegramWeatherRoutes wr JOIN TelegramTargets t ON t.id=wr.target_id JOIN WeatherAlertRules r ON r.id=wr.rule_id JOIN WeatherStations s ON s.id=r.station_id
      ORDER BY s.display_name,r.label,t.title,wr.id`);
    res.json({routes:rows.map(r=>({...r,enabled:Boolean(r.enabled),send_resolved:Boolean(r.send_resolved)}))});
  }catch(error){res.status(500).json({error:'Unable to load Telegram weather routes.'});}
};

const __routeController607 = async (req,res) => {
  try{
    const targetId=telegramParseInt(req.body?.target_id),ruleId=telegramParseInt(req.body?.rule_id);
    if(!targetId||!ruleId)return res.status(400).json({error:'target_id and rule_id are required.'});
    const [target,rule]=await Promise.all([dbGet(`SELECT * FROM TelegramTargets WHERE id=?`,[targetId]),dbGet(`SELECT * FROM WeatherAlertRules WHERE id=?`,[ruleId])]);
    if(!target)return res.status(404).json({error:'Telegram target not found.'}); if(!rule)return res.status(404).json({error:'Weather alert rule not found.'});
    const sendResolved=telegramBool(req.body?.send_resolved,true),enabled=telegramBool(req.body?.enabled,true);
    await dbRun(`INSERT INTO TelegramWeatherRoutes(target_id,rule_id,enabled,send_resolved,created_by_user_id) VALUES(?,?,?,?,?)
      ON CONFLICT(target_id,rule_id) DO UPDATE SET enabled=excluded.enabled,send_resolved=excluded.send_resolved,updated_at=CURRENT_TIMESTAMP`,[targetId,ruleId,enabled?1:0,sendResolved?1:0,req.user?.id||null]);
    logActivity({req,action:'TELEGRAM_WEATHER_ROUTE_SAVE',details:`Telegram weather route target=${targetId}, rule=${ruleId}.`});
    res.json({ok:true});
  }catch(error){res.status(500).json({error:'Unable to save Telegram weather route.'});}
};

const __routeController608 = async (req,res) => {
  try{const id=telegramParseInt(req.params.id);if(!id)return res.status(400).json({error:'Invalid route ID.'});await dbRun(`DELETE FROM TelegramWeatherRoutes WHERE id=?`,[id]);logActivity({req,action:'TELEGRAM_WEATHER_ROUTE_DELETE',details:`Deleted Telegram weather route ${id}.`});res.json({ok:true});}
  catch(error){res.status(500).json({error:'Unable to delete Telegram weather route.'});}
};

const __routeController609 = async (req,res) => {
  try{
    const rows=await dbAll(`SELECT rs.*,t.title AS target_title,t.chat_id,s.display_name AS station_name,s.timezone FROM TelegramReportSchedules rs JOIN TelegramTargets t ON t.id=rs.target_id JOIN WeatherStations s ON s.id=rs.station_id ORDER BY rs.enabled DESC,s.display_name,t.title,rs.id`);
    res.json({schedules:rows.map(r=>({...r,enabled:Boolean(r.enabled)}))});
  }catch(error){res.status(500).json({error:'Unable to load Telegram report schedules.'});}
};

const __routeController610 = async (req,res) => {
  try{
    const targetId=telegramParseInt(req.body?.target_id),stationId=telegramParseInt(req.body?.station_id);
    const frequency=String(req.body?.frequency||'daily').toLowerCase();
    if(!targetId||!stationId)return res.status(400).json({error:'target_id and station_id are required.'});
    if(!['daily','weekly','monthly'].includes(frequency))return res.status(400).json({error:'Frequency must be daily, weekly, or monthly.'});
    const hour=Math.max(0,Math.min(23,telegramParseInt(req.body?.send_hour,7))),minute=Math.max(0,Math.min(59,telegramParseInt(req.body?.send_minute,0)));
    const dayOfWeek=frequency==='weekly'?Math.max(0,Math.min(6,telegramParseInt(req.body?.day_of_week,1))):null;
    const dayOfMonth=frequency==='monthly'?Math.max(1,Math.min(28,telegramParseInt(req.body?.day_of_month,1))):null;
    const [target,station]=await Promise.all([dbGet(`SELECT id FROM TelegramTargets WHERE id=?`,[targetId]),dbGet(`SELECT id FROM WeatherStations WHERE id=?`,[stationId])]);
    if(!target)return res.status(404).json({error:'Telegram target not found.'});if(!station)return res.status(404).json({error:'Weather station not found.'});
    const result=await dbRun(`INSERT INTO TelegramReportSchedules(target_id,station_id,frequency,send_hour,send_minute,day_of_week,day_of_month,enabled,created_by_user_id) VALUES(?,?,?,?,?,?,?,?,?)`,[targetId,stationId,frequency,hour,minute,dayOfWeek,dayOfMonth,telegramBool(req.body?.enabled,true)?1:0,req.user?.id||null]);
    logActivity({req,action:'TELEGRAM_REPORT_SCHEDULE_CREATE',details:`Created Telegram ${frequency} weather report schedule ${result.lastID}.`});
    res.json({id:result.lastID});
  }catch(error){res.status(500).json({error:'Unable to create Telegram report schedule.'});}
};

const __routeController611 = async (req,res) => {
  try{
    const id=telegramParseInt(req.params.id);if(!id)return res.status(400).json({error:'Invalid schedule ID.'});
    const row=await dbGet(`SELECT * FROM TelegramReportSchedules WHERE id=?`,[id]);if(!row)return res.status(404).json({error:'Schedule not found.'});
    const enabled=telegramBool(req.body?.enabled,Boolean(row.enabled));
    await dbRun(`UPDATE TelegramReportSchedules SET enabled=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[enabled?1:0,id]);
    res.json({ok:true});
  }catch(error){res.status(500).json({error:'Unable to update Telegram report schedule.'});}
};

const __routeController612 = async (req,res) => {
  try{const id=telegramParseInt(req.params.id);if(!id)return res.status(400).json({error:'Invalid schedule ID.'});await dbRun(`DELETE FROM TelegramReportSchedules WHERE id=?`,[id]);logActivity({req,action:'TELEGRAM_REPORT_SCHEDULE_DELETE',details:`Deleted Telegram report schedule ${id}.`});res.json({ok:true});}
  catch(error){res.status(500).json({error:'Unable to delete Telegram report schedule.'});}
};

const __routeController613 = async (req,res) => {
  try{
    const limit=Math.max(1,Math.min(500,telegramParseInt(req.query.limit,100)));
    const rows=await dbAll(`SELECT d.*,t.title AS target_title,t.chat_id FROM TelegramDeliveries d JOIN TelegramTargets t ON t.id=d.target_id ORDER BY d.id DESC LIMIT ?`,[limit]);
    res.json({deliveries:rows});
  }catch(error){res.status(500).json({error:'Unable to load Telegram delivery history.'});}
};

const __routeController614 = async (req,res) => {
  try{
    const stations=await dbAll(`SELECT id,display_name,source_name,timezone,enabled FROM WeatherStations ORDER BY display_name,id`);
    const rules=await dbAll(`SELECT r.id,r.station_id,r.alert_type,r.label,r.enabled,s.display_name AS station_name FROM WeatherAlertRules r JOIN WeatherStations s ON s.id=r.station_id ORDER BY s.display_name,r.label,r.id`);
    res.json({stations,rules:rules.map(r=>({...r,enabled:Boolean(r.enabled)}))});
  }catch(error){res.status(500).json({error:'Unable to load Telegram weather configuration options.'});}
};
