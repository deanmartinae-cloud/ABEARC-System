const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'abearc-telegram-credential-'));
const token='123456:'+ 'a'.repeat(35),replacement='123456:'+ 'b'.repeat(35);
const config=read('src/backend/config/22-telegram.config.js'),store=read('src/backend/services/22-telegram-credential.service.js');
const controller=read('src/backend/controllers/22-telegram.controller.js').split('const __routeController600')[0];
class TelegramApiError extends Error {constructor(message){super(message);this.statusCode=502;}}
const states=new Map();let starts=0,stops=0,checks=0;
const ctx=vm.createContext({require,fs,path,crypto,Buffer,DATA_DIR:folder,process:{pid:process.pid,env:{}},console,TelegramApiError,
  telegramApiRequest:async(method,body,options)=>{checks++;assert.equal(method,'getMe');assert(options.token);return {id:123456,username:'fixture_bot'};},
  telegramStateGet:async key=>states.get(key),telegramStateSet:async(key,value)=>states.set(key,value),
  stopTelegramScheduler:async()=>{stops++;},startTelegramScheduler:()=>{starts++;},
  logActivity:entry=>assert(!JSON.stringify({action:entry.action,details:entry.details}).includes(token))});
vm.runInContext(config+'\n'+store+'\n'+controller+'\nthis.save=telegramSaveCredentialController;',ctx);
async function save(role,value){const result={status:200};const res={status(code){result.status=code;return this;},json(body){result.body=body;return this;}};await ctx.save({user:{role},body:{bot_token:value}},res);return result;}
(async()=>{
  for(const role of ['admin','user',undefined])assert.equal((await save(role,token)).status,403);
  assert.equal(checks,0);assert.equal((await save('superadmin','invalid')).status,400);
  const success=await save('superadmin',token);assert.equal(success.status,200);assert.equal(success.body.configured,true);
  assert(!JSON.stringify(success).includes(token));assert.equal(starts,1);assert.equal(stops,1);
  const disk=fs.readFileSync(path.join(folder,'.telegram-credential.enc'),'utf8');assert(!disk.includes(token));
  assert.equal(vm.runInContext('telegramReadBotCredential()',ctx),token);
  const reloaded=vm.createContext({require,fs,path,crypto,Buffer,DATA_DIR:folder,process:{pid:process.pid,env:{TELEGRAM_BOT_TOKEN:'environment-fallback'}},console});
  vm.runInContext(config+'\n'+store,reloaded);assert.equal(vm.runInContext('TELEGRAM_BOT_TOKEN',reloaded),token);
  ctx.telegramApiRequest=async()=>{throw new TelegramApiError('Unauthorized');};
  assert.equal((await save('system',replacement)).status,400);
  assert.equal(vm.runInContext('TELEGRAM_BOT_TOKEN',ctx),token);assert.equal(stops,1);
  assert.equal(fs.readFileSync(path.join(folder,'.telegram-credential.enc'),'utf8'),disk);
  let release;ctx.telegramApiRequest=()=>new Promise(resolve=>{release=resolve;});
  const pending=save('system',replacement);assert.equal((await save('superadmin',token)).status,409);
  release({id:123456,username:'fixture_bot'});assert.equal((await pending).status,200);
  assert.equal(vm.runInContext('TELEGRAM_BOT_TOKEN',ctx),replacement);assert.equal(starts,2);assert.equal(stops,2);
  const envelope=JSON.parse(fs.readFileSync(path.join(folder,'.telegram-credential.enc'),'utf8'));envelope.tag=Buffer.alloc(16).toString('base64');
  fs.writeFileSync(path.join(folder,'.telegram-credential.enc'),JSON.stringify(envelope));
  assert.throws(()=>vm.runInContext('telegramReadBotCredential()',ctx));
  console.log('Telegram credential checks passed: roles, validation, encrypted persistence, restart load, rejected-token recovery, concurrent saves and tamper detection.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>fs.rmSync(folder,{recursive:true,force:true}));
