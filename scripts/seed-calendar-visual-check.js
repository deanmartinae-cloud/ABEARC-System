// Persisted test fixtures only; never reads or writes the supplied production data.
const assert=require('node:assert/strict');
const path=require('node:path'),os=require('node:os'),sqlite3=require('sqlite3');
assert.equal(process.env.ABEARC_CALENDAR_TEST,'1');
const testDataDir=process.env.ABEARC_TEST_DATA_DIR || path.join(os.tmpdir(),'abearc-calendar-2-test');
const db=new sqlite3.Database(path.join(testDataDir,'data.db'));
const run=(sql,params=[])=>new Promise((resolve,reject)=>db.run(sql,params,function(err){err?reject(err):resolve(this.lastID);}));
const get=(sql,params=[])=>new Promise((resolve,reject)=>db.get(sql,params,(err,row)=>err?reject(err):resolve(row)));
(async()=>{
  let project=await get('SELECT id FROM Projects WHERE name=?',['Malagos Nursery SPIS · Calendar test']);
  if(!project)project={id:await run("INSERT INTO Projects(name,requester,district,barangay,stage,status,created_at,updated_at) VALUES (?,?,'Baguio','Malagos','Proposal','Active',?,?)",['Malagos Nursery SPIS · Calendar test','Calendar verification',new Date().toISOString(),new Date().toISOString()])};
  const login=await fetch('http://localhost:3107/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'superadmin',password:'superadmin123'})}).then(r=>r.json());
  const headers={'Content-Type':'application/json',Authorization:`Bearer ${login.token}`};
  const inventory=await get("SELECT id FROM MonitoringInventory WHERE lifecycle_status!='Archived' LIMIT 1");
  const fixtures=[['Malagos Nursery · Site Inspection','site_inspection','08','08:00','12:00'],['Engineering coordination meeting','meeting','09','09:00','10:30'],['Field survey · Irrigation area','site_survey','10','08:00','11:00'],['Asset monitoring visit','monitoring','11','13:00','16:00'],['Weekly project review','meeting','14','09:00','10:00'],['GeoCam field documentation','site_geotagging','16','08:30','11:30'],['Technical training workshop','training','18','08:00','17:00']];
  for(const [title,event_type,day,start,end] of fixtures){
    if(await get('SELECT id FROM CalendarEvents WHERE title=?',[title]))continue;
    const response=await fetch('http://localhost:3107/api/calendar/events',{method:'POST',headers,body:JSON.stringify({title,event_type,start_datetime:`2026-09-${day}T${start}:00+08:00`,end_datetime:`2026-09-${day}T${end}:00+08:00`,participant_user_ids:[1,2,3],location:'Malagos, Davao City',description:'Verify field conditions, review project progress, and collect supporting documentation.',related_project_id:project.id,related_inventory_id:event_type==='monitoring'?inventory.id:null,reminder_minutes:[30,1440],acknowledge_conflicts:true})});
    assert.equal(response.status,201,await response.text());
  }
  console.log('Persisted calendar visual fixtures ready.');
})().catch(err=>{console.error(err);process.exitCode=1;}).finally(()=>db.close());
