let calendarAdvancedFilters = {};
const calendarFilterDialog = document.createElement('dialog');
calendarFilterDialog.className = 'cal-filter-dialog';
calendarFilterDialog.setAttribute('aria-label', 'Calendar filters');
calendarFilterDialog.innerHTML = `<form method="dialog"><header><h3>Filter activities</h3><button aria-label="Close filters" value="cancel">×</button></header><div class="cal-fields">
  <label>From<input name="from" type="date"></label><label>Through<input name="through" type="date"></label>
  <label>Created by<select name="creator"><option value="">Anyone</option><option value="me">Created by me</option></select></label>
  <label>Status<select name="status"><option value="">All statuses</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
  <label>Location<input name="location" placeholder="Any location"></label>
  <label>Priority<select name="priority"><option value="">Any priority</option><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
  <label>Monitoring condition<input name="monitoring" placeholder="e.g. Operational"></label>
  <label>My response<select name="response"><option value="">Any response</option><option value="accepted">Accepted</option><option value="pending">Pending</option><option value="had_prior_schedule">Had Prior Schedule</option><option value="tentative">Tentative</option><option value="declined">Declined</option></select></label>
  <label>Linked project<input name="project" placeholder="Project name"></label>
  <label>When<select name="when"><option value="">All activities</option><option value="upcoming">Upcoming</option><option value="past">Past</option></select></label>
  </div><p class="cal-muted">Participant and activity-type filters are available in the Calendar sidebar. Date ranges apply to Agenda view.</p>
  <footer><button type="button" class="cal-button" onclick="calendarClearAdvancedFilters()">Clear Filters</button><button class="cal-button cal-primary" value="apply">Apply</button></footer></form>`;
document.body.append(calendarFilterDialog);
document.getElementById('calendarToolbarRight').insertAdjacentHTML('beforeend','<button type="button" class="cal-button" onclick="calendarFilterDialog.showModal()">Filters</button>');
calendarFilterDialog.addEventListener('close',()=>{
  if(calendarFilterDialog.returnValue!=='apply')return;
  const fields=new FormData(calendarFilterDialog.querySelector('form'));
  calendarAdvancedFilters=Object.fromEntries(fields.entries());
  if(calendarAdvancedFilters.from && calendarAdvancedFilters.through && calendarAdvancedFilters.from>calendarAdvancedFilters.through){toast('End date must not precede start date.','error');calendarAdvancedFilters={};calendarFilterDialog.showModal();return;}
  if(calendarAdvancedFilters.from || calendarAdvancedFilters.through)calendarDisplayView='agenda';
  loadCalendarView({silent:true});
});
function calendarClearAdvancedFilters(){calendarAdvancedFilters={};calendarFilterDialog.querySelector('form').reset();calendarFilterDialog.close('clear');loadCalendarView({silent:true});}
function calendarAdvancedQuery(params){
  if(calendarDisplayView!=='agenda')return;
  if(calendarAdvancedFilters.from)params.set('start',calendarAdvancedFilters.from+'T00:00');
  if(calendarAdvancedFilters.through)params.set('end',calendarAdvancedFilters.through+'T23:59');
}
function calendarMatchesAdvanced(event){
  const f=calendarAdvancedFilters;
  return (!f.creator || Number(event.created_by_user_id)===Number(currentUser.id))
    && (!f.status || event.status===f.status)
    && (!f.location || String(event.location||'').toLowerCase().includes(f.location.toLowerCase()))
    && (!f.project || String(event.project_name||'').toLowerCase().includes(f.project.toLowerCase()))
    && (!f.priority || (event.priority||'normal')===f.priority)
    && (!f.monitoring || String(event.monitoring_status||'').toLowerCase().includes(f.monitoring.toLowerCase()))
    && (!f.response || event.response_status===f.response)
    && (!f.when || (f.when==='past')===calendarEventHasPassed(event));
}
