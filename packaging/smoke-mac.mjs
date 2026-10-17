// Exercise a downloaded ZIP with no installed Node/Arduino in PATH or HOME.
// Intel binaries can be exercised under Rosetta on an Apple Silicon build host.
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,basename} from 'node:path';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Blockly,generate} from '../src/blocks.js';
import {lessons} from '../src/lessons.js';
const exec=promisify(execFile);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const archive=resolve(process.argv[2]||'');
assert.ok(archive.endsWith('.zip'),'Pass a packaged ZIP path.');
const folder=await mkdtemp(join(tmpdir(),'Arduino package test 中文 '));
const support=join(folder,'Application Support','ArduinoClassroom');
const fakeHome=join(folder,'empty-home');await mkdir(fakeHome);
let launcher, service, output='';
try{
 await exec('/usr/bin/ditto',['-x','-k',archive,folder]);
 const root=join(folder,basename(archive,'.zip'),'Arduino 中文课堂.app','Contents','Resources');
 const env={PATH:'/usr/bin:/bin:/usr/sbin:/sbin',HOME:fakeHome,TMPDIR:tmpdir(),CLASSROOM_SUPPORT_DIR:support,CLASSROOM_NO_OPEN:'1',CLASSROOM_PORT:'3876'};
 const architecture=(await readFile(join(root,'architecture'),'utf8')).trim();
 const native=architecture===process.arch || (architecture==='x86_64'&&process.arch==='x64');
 launcher=native?spawn(join(root,'..','MacOS','ArduinoClassroom'),[],{env,stdio:['ignore','pipe','pipe']}):spawn(join(root,'bin','node'),[join(root,'boot.mjs')],{env,stdio:['ignore','pipe','pipe']});
 launcher.stdout.on('data',b=>output+=b);launcher.stderr.on('data',b=>output+=b);
 for(let i=0;i<240;i++){try{service=JSON.parse(await readFile(join(support,'service.json'),'utf8'));break;}catch{}await pause(250);}
 if(!service){try{output+=await readFile(join(support,'classroom.log'),'utf8');}catch{}throw new Error('Packaged launch failed: '+output);}
 const base=`http://127.0.0.1:${service.port}`;
 assert.equal((await fetch(base)).status,200);
 const status=await (await fetch(base+'/api/status')).json();
 assert.match(status.cli,/1\.5\.1/);assert.match(status.cores,/arduino:avr/);assert.match(status.libraries,/Servo/);
 assert.ok(Array.isArray(status.ports),'Native SerialPort enumeration works');
 const post=(endpoint,body)=>fetch(base+endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Classroom':'local'},body:JSON.stringify(body)});
 for(const lesson of lessons.filter(item=>item.state)){
  const workspace=new Blockly.Workspace();let code;
  try{Blockly.serialization.workspaces.load(structuredClone(lesson.state),workspace);code=generate(workspace).code;}finally{workspace.dispose();}
  const response=await post('/api/build',{code,fqbn:'arduino:avr:uno',upload:false});
  assert.equal(response.status,200,lesson.id+': '+JSON.stringify(await response.json()));
  console.log(`PASS bundled compiler: ${lesson.id}`);
 }
 const events=await fetch(base+'/api/events');const reader=events.body.getReader();
 const first=await reader.read();assert.match(Buffer.from(first.value).toString(),/serial-state/);await reader.cancel();
 const missing=await post('/api/serial',{path:'/tmp/no-board',baudRate:9600});assert.equal(missing.status,400);
 // Reopening reuses this exact service rather than starting another serial owner.
 await exec(join(root,'bin','node'),[join(root,'boot.mjs')],{env,timeout:15000});
 const second=JSON.parse(await readFile(join(support,'service.json'),'utf8'));assert.equal(second.pid,service.pid);
 await exec('/bin/zsh',[join(folder,basename(archive,'.zip'),'停止课堂.command')],{env});
 await pause(1000);
 await assert.rejects(fetch(base+'/api/health',{signal:AbortSignal.timeout(2000)}));
 console.log(`PASS package ${basename(archive)}: empty HOME, system PATH, bundled CLI/core/library, native serial enumeration, SSE, duplicate launch, stop command`);
}finally{
 if(service){try{process.kill(service.pid,'SIGINT');}catch{}}
 if(launcher){await Promise.race([new Promise(resolve=>launcher.once('exit',resolve)),pause(3000)]);try{launcher.kill('SIGTERM');}catch{}}
 await rm(folder,{recursive:true,force:true});
}
