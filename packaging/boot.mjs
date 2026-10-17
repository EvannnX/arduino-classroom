import http from 'node:http';
import {spawn, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir, cp, readFile, writeFile, rename, rm, open, appendFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';

const exec = promisify(execFile);
const root = dirname(fileURLToPath(import.meta.url));
const architecture = (await readFile(join(root,'architecture'),'utf8')).trim();
const support = process.env.CLASSROOM_SUPPORT_DIR || join(homedir(),'Library','Application Support','ArduinoClassroom');
await mkdir(support,{recursive:true});
const logfile = join(support,'classroom.log');
const pidfile = join(support,'service.json');
const lockfile = join(support,'starting.lock');
const runtime = join(support,`tools-1.0.1-${architecture}`);
const childEnv = {...process.env,
  ARDUINO_CLI:join(root,'bin','arduino-cli'),
  ARDUINO_DIRECTORIES_DATA:join(runtime,'data'),
  ARDUINO_DIRECTORIES_DOWNLOADS:join(support,'downloads'),
  ARDUINO_DIRECTORIES_USER:join(runtime,'sketchbook'),
  ARDUINO_BUILD_CACHE_PATH:join(support,'build-cache')};
let state = {step:'正在打开课堂…',ready:false,error:null,url:null};
let child, lockOwned=false, logHandle;
const browser = url => {if(!process.env.CLASSROOM_NO_OPEN)spawn('/usr/bin/open',[url],{stdio:'ignore'}).on('error',()=>{});};
const log = text => appendFile(logfile,`${new Date().toISOString()} ${text}\n`);
const page = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>正在打开 Arduino 中文课堂</title><style>body{font:18px/1.7 system-ui;background:#edf3f8;color:#183349;max-width:620px;margin:12vh auto;padding:30px}main{background:white;border-radius:24px;padding:36px;box-shadow:0 12px 48px #17334a16}h1{font-size:30px}p{overflow-wrap:anywhere}small{color:#53697b}a{color:#1254be}#error{color:#a32929;white-space:pre-wrap}</style><main><h1>Arduino 中文课堂</h1><p id="step">正在准备你的课堂…</p><p id="error"></p><small>运行环境已随下载包提供，无需安装 Node.js 或 Arduino IDE。首次启动需要解包板卡工具，请稍候。</small><p>若 macOS 提示允许访问可移动宗卷、USB 或下载文件夹，请按实际提示允许本应用访问。</p><p id="log"></p></main><script>async function poll(){try{const r=await fetch('/status');const s=await r.json();document.querySelector('#step').textContent=s.step;document.querySelector('#error').textContent=s.error||'';if(s.error)document.querySelector('#log').textContent='启动日志：'+s.logfile;if(s.ready){location.replace(s.url);return;}}catch{}setTimeout(poll,500)}poll()</script></html>`;
const startup = http.createServer((req,res)=>{
  if(req.headers.host!==`127.0.0.1:${startup.address().port}`){res.writeHead(403);return res.end();}
  if(req.url==='/status'){res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify({...state,logfile}));}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(page);
});
await new Promise((resolve,reject)=>{startup.once('error',reject);startup.listen(0,'127.0.0.1',resolve);});
const startupUrl = `http://127.0.0.1:${startup.address().port}`;
async function health(port){try{const response=await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(1000)});return (await response.json()).app==='arduino-classroom';}catch{return false;}}
async function alive(pid){try{process.kill(pid,0);return true;}catch{return false;}}
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function releaseLock(){if(lockOwned){await rm(lockfile,{force:true});lockOwned=false;}}
async function run(){
  // Only reuse the service belonging to this distribution, never an unrelated local server.
  try{const previous=JSON.parse(await readFile(pidfile,'utf8'));if(await alive(previous.pid) && await health(previous.port)){browser(`http://127.0.0.1:${previous.port}`);startup.close();return;}}catch{}
  try{const handle=await open(lockfile,'wx');await handle.writeFile(String(process.pid));await handle.close();lockOwned=true;}
  catch(e){
    if(e.code!=='EEXIST')throw e;
    const pid=Number(await readFile(lockfile,'utf8'));
    if(!Number.isInteger(pid)||pid<=0)throw new Error('启动记录不完整。请关闭其他课堂启动窗口后重试。');
    if(await alive(pid)){browser(startupUrl);for(let i=0;i<240;i++){await pause(500);try{const previous=JSON.parse(await readFile(pidfile,'utf8'));if(await health(previous.port)){state={step:'课堂已准备好',ready:true,url:`http://127.0.0.1:${previous.port}`};setTimeout(()=>startup.close(),5000);return;}}catch{}}throw new Error('另一个课堂正在启动。请稍后重新打开。');}
    await rm(lockfile,{force:true});return run();
  }
  browser(startupUrl);
  if(architecture==='arm64'){
    state.step='正在检查 AVR 编译器运行环境…';
    try{await exec('/usr/bin/arch',['-x86_64','/usr/bin/true']);}
    catch{
      state.step='需要安装 Apple Rosetta';
      state.error='Arduino 官方 AVR 编译器需要 Rosetta。即将打开系统安装窗口，请阅读并确认 Apple 的许可。安装完成后重新打开课堂。';
      // Keep the Apple license prompt interactive; do not accept it on behalf of the user.
      if(!process.env.CLASSROOM_NO_OPEN)await exec('/usr/bin/osascript',['-e','tell application "Terminal" to do script "/usr/sbin/softwareupdate --install-rosetta"']);
      throw new Error(state.error);
    }
  }
  try{await readFile(join(runtime,'.ready'));}
  catch{
    state.step='首次启动：正在准备板卡核心与舵机库…';
    const staging=`${runtime}.tmp-${process.pid}`;
    try{await rm(staging,{recursive:true,force:true});await cp(join(root,'toolchain'),staging,{recursive:true});await writeFile(join(staging,'.ready'),'1.0.1');await rm(runtime,{recursive:true,force:true});await rename(staging,runtime);}
    finally{await rm(staging,{recursive:true,force:true});}
  }
  state.step='正在启动上传与串口服务…';
  logHandle=await open(logfile,'a');
  let port=Number(process.env.CLASSROOM_PORT||3765);
  if(!Number.isInteger(port)||port<1024||port>65525)throw new Error('课堂端口设置无效。');
  // If another program owns the preferred port, choose a nearby local port.
  for(let attempt=0;attempt<10;attempt++,port++){
    child=spawn(process.execPath,[join(root,'app','server.mjs')],{env:{...childEnv,CLASSROOM_PORT:String(port)},stdio:['ignore',logHandle.fd,logHandle.fd]});
    let ended=false, spawnError;
    child.once('error',e=>{ended=true;spawnError=e;});child.once('exit',()=>{ended=true;});
    for(let i=0;i<80&&!ended;i++){await pause(150);if(await health(port)){await pause(150);if(ended)break;
      await writeFile(pidfile,JSON.stringify({pid:child.pid,port}));await releaseLock();state={step:'课堂已准备好',ready:true,url:`http://127.0.0.1:${port}`};await log(`课堂已启动：${state.url}`);
      child.once('exit',async()=>{try{const record=JSON.parse(await readFile(pidfile,'utf8'));if(record.pid===child.pid)await rm(pidfile,{force:true});}catch{}startup.close();await logHandle.close();});
      return;
    }}
    if(spawnError)throw spawnError;
    if(!ended){child.kill('SIGINT');throw new Error('本地服务启动超时。请查看日志后重试。');}
  }
  throw new Error('未能启动本地服务，请查看日志。');
}
process.on('SIGINT',()=>child?child.kill('SIGINT'):process.exit(0));
process.on('SIGTERM',()=>child?child.kill('SIGINT'):process.exit(0));
try{await run();}
catch(e){await releaseLock();state.step='课堂暂时没有打开';state.error=e.message;await log(e.stack||e.message);if(logHandle)await logHandle.close();startup.unref();setTimeout(()=>startup.close(),10*60*1000);}
