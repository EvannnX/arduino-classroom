import express from 'express';
import { SerialPort } from 'serialport';
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.CLASSROOM_PORT || 3765);
const cli = process.env.ARDUINO_CLI || 'arduino-cli';
const boards = [
  {name:'Arduino Uno R3',fqbn:'arduino:avr:uno'},
  {name:'Arduino Nano（ATmega328P）',fqbn:'arduino:avr:nano:cpu=atmega328'},
  {name:'Arduino Nano（旧引导程序）',fqbn:'arduino:avr:nano:cpu=atmega328old'},
  {name:'Arduino Mega 2560',fqbn:'arduino:avr:mega:cpu=atmega2560'}
];
let serial = null, serialConfig = null, busy = false;
const clients = new Set();
function emit(type, data) { for (const res of clients) res.write(`data: ${JSON.stringify({type,...data})}\n\n`); }
function run(args, stream = false) {
  return new Promise((resolve,reject) => {
    const child = spawn(cli,args,{shell:false}); let output='';
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    const timer=setTimeout(()=>child.kill('SIGTERM'),180000);
    const receive=chunk=>{ const text=chunk.toString(); output=(output+text).slice(-240000); if(stream) emit('log',{text}); };
    child.stdout.on('data',receive); child.stderr.on('data',receive);
    child.once('error',e=>{clearTimeout(timer);reject(new Error(e.code==='ENOENT'?'未找到 Arduino CLI，请按使用说明安装。':e.message));});
    child.once('close',(code,signal)=>{clearTimeout(timer);code===0?resolve(output):reject(new Error(signal?'操作超时或已终止。':output||`Arduino CLI 退出码 ${code}`));});
  });
}
app.use((req,res,next)=>{
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)) return res.status(403).json({error:'仅允许本机访问'});
  const origin=req.headers.origin;
  if(origin && ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(origin)) return res.status(403).json({error:'来源不允许'});
  if(req.method==='POST' && req.headers['x-classroom']!=='local') return res.status(403).json({error:'缺少本地请求标记'});
  next();
});
app.use(express.json({limit:'512kb'}));
app.get('/api/health',(req,res)=>res.json({app:'arduino-classroom',ok:true}));
app.get('/api/events',(req,res)=>{
  res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.flushHeaders();clients.add(res);
  res.write(`data: ${JSON.stringify({type:'serial-state',connected:!!serial?.isOpen,...serialConfig})}\n\n`);
  const timer=setInterval(()=>res.write(': heartbeat\n\n'),15000);
  req.on('close',()=>{clearInterval(timer);clients.delete(res);});
});
async function ports(){
  const items=await SerialPort.list();
  return items.filter(p=> !/Bluetooth|debug-console/i.test(p.path)).map(p=>({path:p.path,label:[p.path,p.manufacturer].filter(Boolean).join(' / ')}));
}
app.get('/api/status',async(req,res)=>{
  const results=await Promise.allSettled([run(['version']),run(['core','list','--format','json']),run(['lib','list','--format','json']),ports()]);
  res.json({boards,cli:results[0].status==='fulfilled'?results[0].value.trim():null,cliError:results[0].status==='rejected'?results[0].reason.message:null,cores:results[1].status==='fulfilled'?results[1].value:'',libraries:results[2].status==='fulfilled'?results[2].value:'',ports:results[3].status==='fulfilled'?results[3].value:[],busy,serial:serialConfig});
});
app.get('/api/ports',async(req,res,next)=>{try{res.json(await ports());}catch(e){next(e);}});
async function closeSerial(){
  const current=serial;serial=null;serialConfig=null;
  if(current?.isOpen) await new Promise((resolve)=>current.close(()=>resolve()));
  emit('serial-state',{connected:false});
}
async function openSerial(path,baudRate){
  const connection=new SerialPort({path,baudRate,autoOpen:false});
  await new Promise((resolve,reject)=>connection.open(e=>e?reject(e):resolve()));
  serial=connection;serialConfig={path,baudRate};
  const decoder=new StringDecoder('utf8');
  connection.on('data',buffer=>{const text=decoder.write(buffer);if(text)emit('serial',{text});});
  connection.on('error',e=>emit('log',{text:`串口：${e.message}\n`}));
  connection.on('close',()=>{if(serial===connection){serial=null;serialConfig=null;emit('serial-state',{connected:false});}});
  emit('serial-state',{connected:true,...serialConfig});
}
app.post('/api/serial',async(req,res,next)=>{
  if(busy)return res.status(409).json({error:'正在编译或上传，请稍候。'});
  busy=true;
  try {
    if(req.body.action==='close'){await closeSerial();return res.json({ok:true});}
    const {path,baudRate}=req.body;
    if(!(await ports()).some(p=>p.path===path))throw new Error('请选择当前已连接的串口。');
    if(![9600,19200,38400,57600,115200].includes(baudRate))throw new Error('波特率无效');
    await closeSerial();await openSerial(path,baudRate);res.json({ok:true});
  }catch(e){next(e);}finally{busy=false;}
});
app.post('/api/serial/send',async(req,res,next)=>{
  try{
    if(busy)throw new Error('上传期间不能发送串口消息。');
    if(!serial?.isOpen)throw new Error('请先打开串口。');
    const text=String(req.body.text??''); if(text.length>4096)throw new Error('消息过长');
    await new Promise((resolve,reject)=>serial.write(text,e=>e?reject(e):resolve()));res.json({ok:true});
  }catch(e){next(e);}
});
app.post('/api/build',async(req,res,next)=>{
  if(busy)return res.status(409).json({error:'已有编译或上传任务，请等它完成。'});
  const {code,fqbn,path,upload}=req.body;
  if(typeof code!=='string'||code.length>200000||!code.trim())return res.status(400).json({error:'代码为空或过大。'});
  if(!boards.some(b=>b.fqbn===fqbn))return res.status(400).json({error:'请选择支持的 AVR 开发板。'});
  busy=true;let folder,previous,result,failure;
  try{
    if(upload){
      if(!(await ports()).some(p=>p.path===path))throw new Error('未检测到所选串口。请插入 Arduino 数据线并刷新端口。');
      previous=serialConfig?{...serialConfig}:null;await closeSerial();
    }
    folder=await mkdtemp(join(tmpdir(),'arduino-classroom-'));
    const sketch=join(folder,'Classroom');
    const {mkdir}=await import('node:fs/promises');await mkdir(sketch);
    await writeFile(join(sketch,'Classroom.ino'),code);
    emit('log',{text:`\n${upload?'编译并上传':'编译检查'}：${fqbn}\n`});
    const build=join(folder,'build');
    await run(['compile','--fqbn',fqbn,'--build-path',build,sketch],true);
    if(upload)await run(['upload','--fqbn',fqbn,'--port',path,'--input-dir',build,sketch],true);
    emit('log',{text:upload?'上传成功。开发板已开始运行新程序。\n':'编译通过。\n'});
    result={ok:true,uploaded:!!upload};
  }catch(e){failure=e;}finally{
    if(folder)await rm(folder,{recursive:true,force:true});
    if(previous){try{await openSerial(previous.path,previous.baudRate);}catch(e){emit('log',{text:`请重新打开串口：${e.message}\n`});}}
    busy=false;
  }
  if(failure)next(failure);else res.json(result);
});
app.use(express.static(join(root,'dist')));
app.use((e,req,res,next)=>{console.error(e.message);res.status(400).json({error:e.message});});
const server=app.listen(port,'127.0.0.1',()=>console.log(`Arduino 中文课堂：http://127.0.0.1:${port}`));
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`端口 ${port} 已被占用，请打开 http://127.0.0.1:${port}，或设置 CLASSROOM_PORT。`:e.message);process.exit(1);});
process.on('SIGINT',async()=>{await closeSerial();server.close();process.exit(0);});
