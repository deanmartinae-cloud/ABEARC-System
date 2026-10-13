const assert = require('assert');
const fs = require('fs');
const vm = require('node:vm');
const print = require('../src/frontend/scripts/15-map-print.js');
const rect = { x:100,y:100,w:80,h:60 };
assert.deepStrictEqual(print.edge({x:50,y:120},rect),{x:100,y:120});
assert.deepStrictEqual(print.edge({x:250,y:250},rect),{x:180,y:160});
assert.deepStrictEqual(print.edge({x:120,y:120},rect),{x:100,y:120});
const aligned=print.snap({x:103,y:203,w:60,h:60},[{x:100,y:200,w:60,h:60}],{x:400,y:400},800,800);
assert.deepStrictEqual(aligned.rect,{x:100,y:200,w:60,h:60});assert.strictEqual(aligned.guides.length,2);
assert.deepStrictEqual(print.snap({x:103,y:203,w:60,h:60},[],{x:100,y:200},800,800,true).guides,[]);
const anchor={x:100,y:100},before=JSON.stringify(anchor),obstacles=[];
for(let i=0;i<10;i++){const placed=print.place(anchor,48,48,800,1000,obstacles,[]);assert(placed.x>=0&&placed.y>=0&&placed.x+48<=800&&placed.y+48<=1000);assert(obstacles.every(o=>print.overlap(o,placed)===0));obstacles.push(placed);}
assert.strictEqual(JSON.stringify(anchor),before,'Layout must never mutate the GPS anchor.');
assert.deepStrictEqual(print.papers['Long Bond'],[215.9,330.2]);
const source=fs.readFileSync(require.resolve('../src/frontend/scripts/15-map-print.js'),'utf8');
assert(!/localStorage\.setItem|fetchJson\(|\.setData\(|\bfetch\(|XMLHttpRequest|saveAbearc/.test(source),'Print composer must not persist app state or call write APIs.');
console.log('Map print check passed: edge leaders, snapping/Alt, placement, paper dimensions and sandbox boundaries.');

// Image delivery must authorize the row without reading/decoding the original.
(async () => {
  const service=fs.readFileSync(require.resolve('../src/backend/services/14-map-media.service.js'),'utf8');
  const start=service.indexOf('const getMapMediaForUser =');
  let allowed=true,lookups=0,enrichments=0;
  const context=vm.createContext({
    mapMediaReadAccessClause:async()=>({sql:'m.owner_user_id = ?',params:[7]}),
    dbGet:async(sql,params)=>{lookups++;assert(sql.includes('AND m.owner_user_id = ?'));assert.deepStrictEqual(Array.from(params),[1,7]);return allowed?{id:1}:null;},
    enrichStoredMapMediaSpatialMetadata:async()=>{enrichments++;},
    enrichMapMediaRowWithRecoveredStamp:row=>row
  });
  vm.runInContext(service.slice(start),context);
  await vm.runInContext('getMapMediaForUser({},1,{enrich:false})',context);
  assert.strictEqual(enrichments,0,'thumbnail authorization must not decode image metadata');
  await vm.runInContext('getMapMediaForUser({},1)',context);
  assert.strictEqual(enrichments,1,'photo details retain metadata recovery');
  allowed=false;
  assert.strictEqual(await vm.runInContext('getMapMediaForUser({},1,{enrich:false})',context),null);
  assert.strictEqual(lookups,3,'every request must still check read access');
  console.log('Thumbnail checks passed: access enforced, image delivery skips enrichment, details retain recovery.');
})().catch(error=>{console.error(error);process.exitCode=1;});
