const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const native = new DatabaseSync(':memory:');
native.exec('PRAGMA foreign_keys=ON; CREATE TABLE Users(id INTEGER PRIMARY KEY); INSERT INTO Users(id) VALUES(1);');
const normalizeParams = value => Array.isArray(value) ? value : (value === undefined ? [] : [value]);
const db = {
  serialize(fn) { fn(); },
  run(sql, params, cb) { if (typeof params === 'function') { cb=params; params=[]; } try { const r=native.prepare(sql).run(...normalizeParams(params)); if(cb) cb.call({lastID:Number(r.lastInsertRowid||0),changes:Number(r.changes||0)},null); } catch(e){ if(cb) cb.call({lastID:0,changes:0},e); else throw e; } return this; },
  get(sql, params, cb) { if(typeof params==='function'){cb=params;params=[];} try{cb(null,native.prepare(sql).get(...normalizeParams(params)));}catch(e){cb(e);} },
  all(sql, params, cb) { if(typeof params==='function'){cb=params;params=[];} try{cb(null,native.prepare(sql).all(...normalizeParams(params)));}catch(e){cb(e);} },
  prepare(sql) { const st=native.prepare(sql); return { run(params,cb){if(typeof params==='function'){cb=params;params=[];}try{const r=st.run(...normalizeParams(params));if(cb)cb.call({lastID:Number(r.lastInsertRowid||0),changes:Number(r.changes||0)},null);}catch(e){if(cb)cb.call({lastID:0,changes:0},e);else throw e;}return this;}, finalize(cb){if(cb)cb(null);} }; }
};
const dbAll=(sql,params=[])=>new Promise((resolve,reject)=>db.all(sql,params,(e,rows)=>e?reject(e):resolve(rows||[])));
const dbGet=(sql,params=[])=>new Promise((resolve,reject)=>db.get(sql,params,(e,row)=>e?reject(e):resolve(row||null)));
const dbRun=(sql,params=[])=>new Promise((resolve,reject)=>db.run(sql,params,function(e){e?reject(e):resolve({lastID:this.lastID,changes:this.changes});}));
const prefix=[
"const WEATHER_PROVIDER='zentra';",
"const WEATHER_DEFAULT_TIMEZONE='Asia/Manila';",
"const WEATHER_SYNC_INTERVAL_MINUTES=15;",
"const WEATHER_DISCOVERY_INTERVAL_MINUTES=60;",
"const WEATHER_MAX_HISTORY_ROWS=250000;",
"const WEATHER_MAX_EXPORT_ROWS=500000;",
"const WEATHER_ALERT_COOLDOWN_MINUTES=60;",
"const ZENTRA_API_KEY='fixture-only';",
"const WEATHER_PROVIDER_LABELS={zentra:'ZENTRA Cloud'};",
"const logError=()=>{};",
"const getUsersWithPrivilege=async()=>[];",
"const getSuperAdminIdsAsync=async()=>[];",
"const insertNotifications=()=>{};",
"const discoverZentraDevices=async()=>[];",
"let fetchZentraReadingPage=async()=>({values:[]});",
"const weatherValidateZentraNextUrl=v=>v;",
"class WeatherProviderError extends Error { constructor(message,opts={}){super(message);Object.assign(this,opts);} }"
].join('\n');
const sourceFiles=['src/backend/migrations/21-weather.migration.js','src/backend/services/21-weather-analytics.service.js','src/backend/services/21-weather-sync.service.js'];
const source=prefix+'\n'+sourceFiles.map(f=>fs.readFileSync(path.join(ROOT,f),'utf8')).join('\n')+'\n'+fs.readFileSync(path.join(ROOT,'scripts/test-weather-workflow.fixture.js'),'utf8');
const fn=new Function('require','console','process','Buffer','crypto','assert','db','dbAll','dbGet','dbRun',source);
fn(require,console,process,Buffer,crypto,assert,db,dbAll,dbGet,dbRun);
