// Scheduling interactions extend the existing Calendar forms and API.
function calendarSchedulingFields(event = {}) {
  const host = document.getElementById('calendarSchedulingFields');
  host.innerHTML = `<label class="cal-check"><input id="calendarAllDay" type="checkbox" ${event.all_day ? 'checked' : ''}> All-day activity</label>
    <details><summary>Find Available Schedule</summary>
      <p class="cal-muted">Check the selected participants’ ABEARC activities. Selecting a time fills the form; save to confirm.</p>
      <div class="cal-fields"><label>From<input id="calFindFrom" type="date" value="${document.getElementById('calendarEventStart').value.slice(0,10)}"></label>
      <label>Through<input id="calFindThrough" type="date" value="${shiftDateKey(document.getElementById('calendarEventStart').value.slice(0,10), 6)}"></label>
      <label>Duration (minutes)<input id="calFindDuration" type="number" min="15" max="720" step="15" value="60"></label>
      <label>Working day starts<input id="calWorkStart" type="time" value="08:00"></label>
      <label>Working day ends<input id="calWorkEnd" type="time" value="17:00"></label>
      <label>Preference<select id="calPreference"><option value="">Any time</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option></select></label></div>
      <button type="button" class="cal-button" onclick="calendarFindSchedule()">Find available times</button>
      <div id="calScheduleResults" aria-live="polite"></div>
    </details><details><summary>Linked project</summary><label for="calProject">Project</label><select id="calProject"><option value="">No linked project</option>${projCache.map(p => `<option value="${Number(p.id)}" ${Number(event.project_id) === Number(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></details>
    ${event.series_id ? '<label>Apply changes to<select id="calSeriesScope"><option value="this">This occurrence</option><option value="future">This and future occurrences</option><option value="series">Entire series</option></select></label>' : `<details><summary>Repeat activity</summary><div class="cal-fields"><label>Repeat<select id="calRepeat" onchange="document.getElementById('calRepeatBaseWrap').classList.toggle('hidden',this.value!=='custom')"><option value="">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="custom">Custom</option></select></label><label id="calRepeatBaseWrap" class="hidden">Custom unit<select id="calRepeatBase"><option value="daily">Day</option><option value="weekly">Week</option><option value="monthly">Month</option><option value="yearly">Year</option></select></label><label>Every (interval)<input id="calRepeatInterval" type="number" min="1" max="365" value="1"></label><label>Occurrences (including first)<input id="calRepeatCount" type="number" min="2" max="60" value="6"></label></div><p class="cal-muted">Creates up to 60 saved occurrences with reminders and participant responses for each. Use every 3 months for quarterly activities.</p></details>`}
    <details ontoggle="if(this.open)calendarLoadInventoryOptions()"><summary>Linked asset / monitoring</summary><label>Inventory record<select id="calInventory" ${hasPrivilege('schedule_monitoring_visit')?'':'disabled'}><option value="">No linked asset</option>${event.related_inventory_id?`<option selected value="${Number(event.related_inventory_id)}">${esc(event.inventory_name||'Linked monitoring record')}</option>`:''}</select></label><p class="cal-muted">${hasPrivilege('schedule_monitoring_visit')?'Uses the existing Established Project & Asset Monitoring registry.':'Scheduling permission is required to change this link.'}</p></details>
    <details><summary>More options</summary><div class="cal-fields">
      <label>Custom reminder (minutes before)<input id="calCustomReminder" type="number" min="0" max="525600" step="1" placeholder="Optional"></label>
      <label>Priority<select id="calPriority">${['low','normal','high','urgent'].map(p=>`<option ${p===(event.priority||'normal')?'selected':''}>${p}</option>`).join('')}</select></label>
      <label>Meeting link<input id="calMeetingLink" type="url" placeholder="https://" value="${esc(event.meeting_link||'')}"></label>
      <label>Status<select id="calEventStatus">${['active','completed','cancelled'].map(p=>`<option ${p===(event.status||'active')?'selected':''}>${p}</option>`).join('')}</select></label>
      <label>Notes<textarea id="calNotes" rows="3">${esc(event.notes||'')}</textarea></label></div>
      <p class="cal-muted">Attach documents after saving using the activity’s Documents section. Google Calendar synchronization is not configured.</p>
    </details><div id="calConflictResults" aria-live="polite"></div>`;
}

async function calendarCheckConflicts(body) {
  return (await fetchJson(`${API}/calendar/conflicts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), silentLoading: true })).conflicts;
}

function calendarConflictMarkup(conflicts) {
  return `<div class="cal-conflict"><strong>Schedule conflict</strong>${conflicts.map(c => `<p>${esc(c.username)} · ${esc(c.title)}<br><small>${esc(fmtDateTime(c.start))} – ${esc(fmtDateTime(c.end || c.start))}</small></p>`).join('')}<p>Change the time, remove a participant, or use Find Available Schedule.</p></div>`;
}

async function calendarConfirmConflicts(body, eventId) {
  const conflicts = await calendarCheckConflicts({ ...body, exclude_event_id: eventId });
  document.getElementById('calConflictResults').innerHTML = conflicts.length ? calendarConflictMarkup(conflicts) : '';
  if (!conflicts.length) return true;
  return confirmModalChoice(calendarConflictMarkup(conflicts), { title: 'Review schedule conflicts', confirmText: 'Proceed Anyway' });
}

let calendarPickerCheck=0;
async function calendarLoadPickerAvailability(users) {
  const requestId=++calendarPickerCheck;
  const start=document.getElementById('calendarEventStart').value;
  if(!start)return;
  try{
    const conflicts=await calendarCheckConflicts({start_datetime:start,end_datetime:document.getElementById('calendarEventEnd').value||null,participant_user_ids:users.map(u=>Number(u.id)),exclude_event_id:document.getElementById('calendarEventId').value});
    if(requestId!==calendarPickerCheck)return;
    for(const user of users){const element=document.querySelector(`[data-calendar-availability="${Number(user.id)}"]`);if(!element)continue;const conflict=conflicts.find(c=>Number(c.user_id)===Number(user.id));element.textContent=conflict?'⚠ Schedule conflict':'✓ Available';element.title=conflict?`${conflict.title} · ${fmtDateTime(conflict.start)}`:'No overlapping ABEARC activities';}
  }catch{if(requestId===calendarPickerCheck)document.querySelectorAll('[data-calendar-availability]').forEach(el=>el.textContent='Availability unavailable');}
}

async function calendarFindSchedule() {
  const result = document.getElementById('calScheduleResults');
  result.textContent = 'Checking participants…';
  try {
    const body = { from: document.getElementById('calFindFrom').value, through: document.getElementById('calFindThrough').value,
      duration: Number(document.getElementById('calFindDuration').value), work_start: document.getElementById('calWorkStart').value,
      work_end: document.getElementById('calWorkEnd').value, preference: document.getElementById('calPreference').value,
      participant_user_ids: selectedCalendarParticipantIds(), exclude_event_id: document.getElementById('calendarEventId').value };
    const data = await fetchJson(`${API}/calendar/availability`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), silentLoading: true });
    result.innerHTML = data.slots.length ? data.slots.map(slot => `<button type="button" class="cal-slot" onclick="calendarUseSlot('${slot.start}', '${slot.end}')"><strong>${esc(fmtDateTime(slot.start))}</strong><span> – ${esc(new Date(slot.end).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}</span><small>✓ Everyone available</small></button>`).join('') : '<p>No shared times found. Try a wider date range or different working hours.</p>';
  } catch (err) { result.textContent = err.message || 'Availability could not be checked. Please try again.'; }
}

function calendarUseSlot(start, end) {
  document.getElementById('calendarEventStart').value = toDateTimeLocal(start);
  document.getElementById('calendarEventEnd').value = toDateTimeLocal(end);
  document.getElementById('calendarAllDay').checked = false;
  document.getElementById('calScheduleResults').textContent = 'Time selected. Review the activity and save to confirm.';
}

function calendarEnhanceDetail(full) {
  const body = document.getElementById('calendarEventDetailBody');
  if(full.priority && full.priority!=='normal')body.insertAdjacentHTML('beforeend',`<p>Priority: ${esc(full.priority)}</p>`);
  if(full.meeting_link && /^https?:\/\//i.test(full.meeting_link))body.insertAdjacentHTML('beforeend',`<a class="cal-button" href="${esc(full.meeting_link)}" target="_blank" rel="noopener noreferrer">Join meeting</a>`);
  if(full.notes)body.insertAdjacentHTML('beforeend',`<details><summary>Notes</summary><p class="whitespace-pre-wrap">${esc(full.notes)}</p></details>`);
  if (full.related_inventory_id) body.insertAdjacentHTML('beforeend', `<section><strong>${esc(full.inventory_name||'Monitoring activity')}</strong><p class="cal-muted">${esc(full.inventory_code)} · ${esc(full.monitoring_status)}<br>Last monitoring: ${esc(full.last_monitoring_date?fmtDateOnly(full.last_monitoring_date):'Not recorded')}<br>Evidence: use the monitoring record for required geotagged photographs.</p><button class="cal-button" onclick="closeModal('calendarEventDetailModal');openMonitoringDetail(${Number(full.related_inventory_id)})">Open Monitoring Record</button>${full.latitude!==null && full.longitude!==null && Number.isFinite(Number(full.latitude)) && Number.isFinite(Number(full.longitude))?`<button class="cal-button" onclick="closeModal('calendarEventDetailModal');showAbearcMapLocation(${Number(full.latitude)},${Number(full.longitude)})">Open in Geotag Map</button>`:''}</section>`);
  if(full.project_id)body.insertAdjacentHTML('beforeend',`<p class="cal-muted">Project status: ${esc(full.project_status || full.project_stage)}<br>${esc(full.project_location || '')}</p>`);
  if (full.audit?.length) body.insertAdjacentHTML('beforeend', `<details><summary>Activity history</summary>${full.audit.map(a => `<p class="cal-muted"><strong>${esc(a.username || 'System')}</strong> · ${esc(fmtDateTime(a.created_at))}<br>${esc(a.action.replaceAll('_',' '))}<br>${esc(a.details || '')}</p>`).join('')}</details>`);
}

function calendarOrganizeDetailActions(){
  const actions=document.getElementById('calendarEventDetailActions');
  const secondary=[...actions.querySelectorAll('button')].filter(button=>/^(cancelCalendarEvent|deleteCalendarEvent)/.test(button.getAttribute('onclick')||''));
  if(!secondary.length)return;
  const more=document.createElement('details');more.className='cal-more-actions';more.innerHTML='<summary class="cal-button">More</summary>';
  secondary.forEach(button=>more.append(button));actions.append(more);
}

async function calendarLoadInventoryOptions(){
  const select=document.getElementById('calInventory');
  if(select.disabled || select.dataset.loaded || !hasPrivilege('view_monitoring_inventory'))return;
  const selected=select.value;
  try { const items=await fetchJson(`${API}/monitoring/inventory`,{silentLoading:true});select.innerHTML='<option value="">No linked asset</option>'+items.filter(item=>item.lifecycle_status!=='Archived'||Number(item.id)===Number(selected)).map(item=>`<option value="${Number(item.id)}">${esc(item.inventory_code+' · '+item.asset_name)}</option>`).join('');select.value=selected;select.dataset.loaded='1'; }
  catch(err){toast(err.message||'Could not load monitoring records.','error');}
}

async function calendarReschedule() {
  const event = currentCalendarDetailEvent;
  closeModal('calendarEventDetailModal');
  await openCalendarEventModal(event.raw_id);
  document.getElementById('calendarEventModalTitle').textContent = 'Reschedule Activity';
  document.getElementById('calendarSchedulingFields').insertAdjacentHTML('afterbegin', `<p class="cal-muted">Original schedule: ${esc(calendarEventDateRangeLabel(event))}. ${event.participants.length} participant(s) will be affected. Save to review conflicts and confirm the change.</p>`);
  document.getElementById('calendarEventStart').focus();
}

async function calendarDuplicate() {
  const event = currentCalendarDetailEvent;
  closeModal('calendarEventDetailModal');
  await openCalendarEventModal(event.raw_id);
  document.getElementById('calendarEventId').value = '';
  document.getElementById('calendarEventTitle').value = `${event.title} (copy)`;
  document.getElementById('calendarEventModalTitle').textContent = 'Duplicate Activity';
}

// Keep keyboard focus within the visible Calendar dialog; restore it on close.
let calendarDialogReturnFocus = null;
const calendarDialogObserver = new MutationObserver(records => {
  for (const { target } of records) {
    if (!target.classList.contains('hidden')) {
      calendarDialogReturnFocus = document.activeElement;
      target.setAttribute('role', 'dialog');
      target.setAttribute('aria-modal', 'true');
      target.setAttribute('aria-labelledby', target.id === 'calendarEventModal' ? 'calendarEventModalTitle' : 'calendarEventDetailTitle');
      target.querySelector('input:not([type=hidden]),button')?.focus();
    } else if (calendarDialogReturnFocus?.isConnected) calendarDialogReturnFocus.focus();
  }
});
['calendarEventModal','calendarEventDetailModal'].forEach(id => calendarDialogObserver.observe(document.getElementById(id), {attributes:true, attributeFilter:['class']}));
document.getElementById('calendarEventForm').addEventListener('submit',event=>{event.preventDefault();saveCalendarEvent();});
document.querySelectorAll('#calendarEventForm label').forEach(label=>{const input=label.parentElement.querySelector('input,select,textarea');if(input?.id)label.htmlFor=input.id;});
document.addEventListener('keydown', event => {
  const dialog = ['calendarEventModal','calendarEventDetailModal'].map(id=>document.getElementById(id)).find(el=>!el.classList.contains('hidden') && el.contains(document.activeElement));
  if (!dialog) return;
  if (event.key === 'Escape') { closeModal(dialog.id); event.preventDefault(); }
  if (event.key !== 'Tab') return;
  const items = [...dialog.querySelectorAll('button,input,select,textarea,summary,a[href]')].filter(el=>!el.disabled && el.getClientRects().length);
  const first=items[0], last=items[items.length-1];
  if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); }
  if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
});

document.getElementById('calendarGrid').addEventListener('dragstart', event => {
  const card=event.target.closest('[data-drag-calendar]');
  if (card) event.dataTransfer.setData('text/plain',card.dataset.dragCalendar);
});
document.getElementById('calendarGrid').addEventListener('dragover', event => {
  if (event.target.closest('[data-calendar-date]')) event.preventDefault();
});
document.getElementById('calendarGrid').addEventListener('drop', async event => {
  const cell=event.target.closest('[data-calendar-date]');
  if (!cell) return;
  event.preventDefault();
  const activity=lastCalendarEventsCache.find(e=>e.id===event.dataTransfer.getData('text/plain'));
  if (!activity?.can_edit) return;
  const day=cell.dataset.calendarDate;
  if (day===calendarEventDateKey(activity)) return;
  const confirmed=await confirmModalChoice(`Move ${esc(activity.title)} from ${esc(fmtDateOnly(activity.start))} to ${esc(fmtDateOnly(day))}? Review the new time and conflicts before saving.`,{title:'Move activity?',confirmText:'Review New Schedule'});
  if (!confirmed) return;
  await openCalendarEventModal(activity.raw_id);
  const delta=new Date(`${day}T00:00:00+08:00`)-new Date(`${calendarEventDateKey(activity)}T00:00:00+08:00`);
  document.getElementById('calendarEventStart').value=toDateTimeLocal(new Date(+new Date(activity.start)+delta));
  document.getElementById('calendarEventEnd').value=activity.end ? toDateTimeLocal(new Date(+new Date(activity.end)+delta)) : '';
  document.getElementById('calendarEventModalTitle').textContent='Confirm Reschedule';
});
