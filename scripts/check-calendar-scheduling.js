// Run only against the isolated database started with ABEARC_DATA_DIR and PORT=3107.
const assert = require('node:assert/strict');
const base = 'http://localhost:3107/api';
async function request(path, token, body, method='POST') {
  const response = await fetch(base+path, { method, headers:{'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {})}, ...(body ? {body:JSON.stringify(body)} : {}) });
  return {status:response.status, data:await response.json()};
}
(async()=>{
  assert.equal(process.env.ABEARC_CALENDAR_TEST, '1', 'Set ABEARC_CALENDAR_TEST=1 for the isolated test server.');
  const admin=(await request('/auth/login',null,{username:'superadmin',password:'superadmin123'})).data;
  const user=(await request('/auth/login',null,{username:'user',password:'user123'})).data;
  const when='2026-09-15';
  const event={title:`Calendar check ${Date.now()}`,event_type:'meeting',start_datetime:`${when}T09:00:00+08:00`,end_datetime:`${when}T10:00:00+08:00`,participant_user_ids:[admin.user.id,user.user.id],reminder_minutes:[30],acknowledge_conflicts:true};
  const created=await request('/calendar/events',admin.token,event);
  assert.equal(created.status,201,JSON.stringify(created.data));
  const id=created.data.event.raw_id;
  const conflict=await request('/calendar/conflicts',admin.token,event);
  assert(conflict.data.conflicts.some(c=>c.event_id===id));
  const adjacent=await request('/calendar/conflicts',admin.token,{...event,start_datetime:`${when}T10:00:00+08:00`,end_datetime:`${when}T11:00:00+08:00`});
  assert(!adjacent.data.conflicts.some(c=>c.event_id===id),'Adjacent intervals must not overlap');
  const denied=await request(`/calendar/events/${id}`,user.token,{title:'Unauthorized edit'},'PUT');
  assert.equal(denied.status,403);
  assert.equal((await request('/calendar/events',admin.token,{...event,acknowledge_conflicts:false})).status,409);
  const slots=await request('/calendar/availability',admin.token,{from:when,through:when,duration:60,work_start:'08:00',work_end:'17:00',participant_user_ids:event.participant_user_ids});
  assert.equal(slots.status,200,JSON.stringify(slots.data));
  assert(slots.data.slots.length);
  assert(slots.data.slots.every(s=>!(new Date(s.start)<new Date(event.end_datetime)&&new Date(s.end)>new Date(event.start_datetime))));
  for(const response_status of ['accepted','had_prior_schedule','tentative','declined']) {
    const response=await request(`/calendar/events/${id}/respond`,user.token,{response_status});
    assert.equal(response.status,200,`${response_status}: ${JSON.stringify(response.data)}`);
  }
  const read=await request(`/calendar/events/${id}`,admin.token,null,'GET');
  assert.deepEqual(read.data.event.reminder_minutes,[30]);
  assert(read.data.event.audit.length);
  const metadata=await request(`/calendar/events/${id}`,admin.token,{priority:'high',meeting_link:'https://example.com/meeting',notes:'Operational follow-up',acknowledge_conflicts:true},'PUT');
  assert.equal(metadata.status,200,JSON.stringify(metadata.data));
  assert.equal(metadata.data.event.priority,'high');
  assert.equal(metadata.data.event.notes,'Operational follow-up');
  assert.equal((await request(`/calendar/events/${id}`,admin.token,{meeting_link:'javascript:alert(1)',acknowledge_conflicts:true},'PUT')).status,400);
  assert.equal((await request(`/calendar/events/${id}`,admin.token,{participant_user_ids:[999999],acknowledge_conflicts:true},'PUT')).status,400);
  const form=new FormData();form.append('file',new Blob(['Calendar attachment verification'],{type:'text/plain'}),'calendar-check.txt');
  const uploaded=await fetch(`${base}/calendar/events/${id}/attachments`,{method:'POST',headers:{Authorization:`Bearer ${admin.token}`},body:form});
  assert.equal(uploaded.status,201,await uploaded.text());
  const recurring=await request('/calendar/events',admin.token,{...event,title:'Recurring field inspection',event_type:'site_inspection',repeat:{frequency:'weekly',interval:1,count:3}});
  assert.equal(recurring.status,201,JSON.stringify(recurring.data));
  assert(recurring.data.event.series_id);
  const listed=await request('/calendar/events?start=2026-09-01&end=2026-10-10&scope=abe',admin.token,null,'GET');
  const series=listed.data.events.filter(e=>e.series_id===recurring.data.event.series_id);
  assert.equal(series.length,3);
  const changed=await request(`/calendar/events/${series[0].raw_id}`,admin.token,{...event,title:'Updated series',series_scope:'series'},'PUT');
  assert.equal(changed.status,200,JSON.stringify(changed.data));
  assert.equal(changed.data.updated_count,3);
  const occurrence=await request(`/calendar/events/${series[1].raw_id}`,admin.token,{title:'Only this occurrence',acknowledge_conflicts:true},'PUT');
  assert.equal(occurrence.status,200,JSON.stringify(occurrence.data));
  assert.equal((await request(`/calendar/events/${series[0].raw_id}`,admin.token,null,'GET')).data.event.title,'Updated series');
  assert.equal((await request(`/calendar/events/${series[0].raw_id}/permanent?scope=series`,admin.token,null,'DELETE')).status,200);
  assert.equal((await request(`/calendar/events/${series[1].raw_id}`,admin.token,null,'GET')).status,404);
  assert.equal((await request(`/calendar/events/${id}`,admin.token,{status:'archived',acknowledge_conflicts:true},'PUT')).status,200);
  console.log('Calendar checks passed: creation, conflicts, adjacent intervals, availability, four responses, reminder persistence, history, unauthorized edit.');
  console.log('Recurrence checks passed: three saved occurrences, entire-series edit, isolated occurrence edit, entire-series deletion.');
})().catch(err=>{console.error(err);process.exitCode=1;});
