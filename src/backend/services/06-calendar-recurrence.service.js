const calendarRepeatWindows = body => {
  const {start,end}=calendarScheduleInput(body);
  const rule=body.repeat;
  if (!rule || !rule.frequency) return [{start,end}];
  if (!['daily','weekly','monthly','yearly'].includes(rule.frequency) || !Number.isInteger(rule.interval) || rule.interval<1 || rule.interval>365 || !Number.isInteger(rule.count) || rule.count<2 || rule.count>60) throw calendarScheduleError('Repeat requires a valid frequency, interval (1–365) and 2–60 occurrences.');
  const wall=new Date(+start+8*3600000),duration=end-start;
  return Array.from({length:rule.count},(_,index)=>{
    const next=new Date(wall);
    const offset=index*rule.interval;
    if (rule.frequency==='daily'||rule.frequency==='weekly') next.setUTCDate(wall.getUTCDate()+offset*(rule.frequency==='weekly'?7:1));
    else {
      next.setUTCDate(1);
      next.setUTCMonth(wall.getUTCMonth()+offset*(rule.frequency==='yearly'?12:1));
      const last=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();
      next.setUTCDate(Math.min(wall.getUTCDate(),last));
    }
    const occurrenceStart=new Date(+next-8*3600000);
    return {start:occurrenceStart,end:new Date(+occurrenceStart+duration)};
  });
};

// Separate connection keeps the complete series and participants atomic without
// placing unrelated Express requests inside this transaction.
const calendarInsertActivities = async (req, body, sql, values, participants) => {
  const windows=calendarRepeatWindows(body);
  const connection=new sqlite3.Database(DB_PATH);
  connection.configure('busyTimeout',10000);
  const run=(query,params=[])=>new Promise((resolve,reject)=>connection.run(query,params,function(err){err?reject(err):resolve({lastID:this.lastID});}));
  const series=windows.length>1?crypto.randomUUID():null;
  let firstId;
  try {
    await run('BEGIN IMMEDIATE');
    for (let index=0;index<windows.length;index++) {
      const params=[...values];
      params[3]=windows[index].start.toISOString();
      params[4]=body.end_datetime||series?windows[index].end.toISOString():null;
      if(series)params[14]=JSON.stringify(body.repeat);
      const inserted=await run(sql,params);
      firstId ||= inserted.lastID;
      if(body.related_inventory_id)await run('UPDATE CalendarEvents SET related_inventory_id=? WHERE id=?',[Number(body.related_inventory_id),inserted.lastID]);
      if(series)await run('UPDATE CalendarEvents SET series_id=?, recurrence_index=? WHERE id=?',[series,index,inserted.lastID]);
      for(const userId of participants)await run(`INSERT INTO CalendarEventParticipants(event_id,user_id,role,response_status,notified_at) VALUES (?,?,'participant',?,?)`,[inserted.lastID,userId,Number(userId)===Number(req.user.id)?'accepted':'pending',new Date().toISOString()]);
      await run('INSERT INTO CalendarEventAuditLogs(event_id,actor_user_id,action,details) VALUES (?,?,?,?)',[inserted.lastID,req.user.id,'CALENDAR_EVENT_CREATED',series?`Recurring activity ${index+1} of ${windows.length}`:body.title]);
    }
    await run('COMMIT');
    return {lastID:firstId};
  } catch(err) { await run('ROLLBACK').catch(()=>{});throw err; }
  finally { await new Promise(resolve=>connection.close(resolve)); }
};

const calendarUpdateSeries = async (req,res,event) => {
  const body=req.body;
  calendarValidateMetadata(body);
  if(body.related_inventory_id!==undefined && Number(body.related_inventory_id||0)!==Number(event.related_inventory_id||0))return res.status(400).json({error:'Change monitoring links one occurrence at a time.'});
  if (!event.series_id || !['future','series'].includes(body.series_scope)) return res.status(400).json({error:'Choose a valid recurring series scope.'});
  const rows=await dbAll('SELECT * FROM CalendarEvents WHERE series_id=? AND (? = ? OR recurrence_index>=?) ORDER BY recurrence_index',[event.series_id,body.series_scope,'series',event.recurrence_index]);
  const delta=+parseManualDueDateInput(body.start_datetime || event.start_datetime)-+new Date(event.start_datetime);
  const end=body.end_datetime?parseManualDueDateInput(body.end_datetime):new Date(+new Date(event.end_datetime||event.start_datetime)+delta);
  const duration=+end-(+new Date(event.start_datetime)+delta);
  if(!Number.isFinite(delta)||!Number.isFinite(duration)||duration<=0)return res.status(400).json({error:'Choose a valid schedule.'});
  const type=assertManualCalendarType(body.event_type||event.event_type);
  const participants=body.participant_user_ids || (await getCalendarEventFull(event.id)).participants.map(p=>p.user_id);
  if(type==='personal'&&participants.length>1)return res.status(400).json({error:'Personal activities allow one participant.'});
  if(body.related_project_id && !(await dbGet('SELECT id FROM Projects WHERE id=?',[Number(body.related_project_id)])))return res.status(400).json({error:'Related project not found.'});
  const conflicts=[];
  for(const row of rows){
    if(!(await canEditCalendarEvent(req.user,row)))return forbidden(res);
    const start=new Date(+new Date(row.start_datetime)+delta),end=new Date(+start+duration);
    row.nextStart=start.toISOString();row.nextEnd=end.toISOString();
    conflicts.push(...(await calendarScheduleConflicts(req,{start_datetime:row.nextStart,end_datetime:row.nextEnd,participant_user_ids:participants,exclude_event_id:row.id})).filter(c=>!rows.some(r=>r.id===c.event_id)));
  }
  if(conflicts.length&&body.acknowledge_conflicts!==true)return res.status(409).json({error:'The series contains schedule conflicts.',conflicts});
  const connection=new sqlite3.Database(DB_PATH);connection.configure('busyTimeout',10000);
  const run=(sql,params=[])=>new Promise((resolve,reject)=>connection.run(sql,params,err=>err?reject(err):resolve()));
  try{
    await run('BEGIN IMMEDIATE');
    for(const row of rows){
      await run(`UPDATE CalendarEvents SET title=?,description=?,location=?,start_datetime=?,end_datetime=?,all_day=?,event_type=?,event_type_detail=?,related_project_id=?,reminder_minutes=?,updated_at=?,priority=?,meeting_link=?,notes=?,status=? WHERE id=?`,[String(body.title??row.title).trim(),String(body.description??row.description??''),String(body.location??row.location??''),row.nextStart,row.nextEnd,(body.all_day??row.all_day)?1:0,type,normalizeCalendarTypeDetail(type,body.event_type_detail??row.event_type_detail),body.related_project_id!==undefined?(Number(body.related_project_id)||null):row.related_project_id,Array.isArray(body.reminder_minutes)?JSON.stringify(body.reminder_minutes):row.reminder_minutes,new Date().toISOString(),body.priority??row.priority??'normal',String(body.meeting_link??row.meeting_link??''),String(body.notes??row.notes??''),body.status??row.status??'active',row.id]);
      if(participants.length)await run(`DELETE FROM CalendarEventParticipants WHERE event_id=? AND user_id NOT IN (${participants.map(()=>'?').join(',')})`,[row.id,...participants]);
      else await run('DELETE FROM CalendarEventParticipants WHERE event_id=?',[row.id]);
      for(const userId of participants)await run(`INSERT OR IGNORE INTO CalendarEventParticipants(event_id,user_id,role,response_status) VALUES (?,?,'participant',?)`,[row.id,userId,Number(userId)===Number(row.created_by_user_id)?'accepted':'pending']);
      await run('INSERT INTO CalendarEventAuditLogs(event_id,actor_user_id,action,details) VALUES (?,?,?,?)',[row.id,req.user.id,'CALENDAR_SERIES_UPDATED',`${row.start_datetime} → ${row.nextStart}`]);
    }
    await run('COMMIT');
  }catch(err){await run('ROLLBACK').catch(()=>{});throw err;}finally{await new Promise(resolve=>connection.close(resolve));}
  for(const row of rows){const updated=await getCalendarEventFull(row.id);await syncMonitoringInventoryScheduleFromCalendar(updated);notifyCalendarUsers({req,event:updated,recipients:participants.filter(id=>Number(id)!==Number(req.user.id)),type:'calendar_event_updated',message:`Recurring schedule updated: ${updated.title}.`,alertKeyBase:`calendar_series_updated:${row.id}:${Date.now()}`,cooldownMinutes:0});}
  return res.json({success:true,event:await normalizeManualCalendarEvent(req,await getCalendarEventFull(event.id)),updated_count:rows.length});
};
