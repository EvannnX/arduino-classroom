import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Blockly,generate} from '../src/blocks.js';
import {lessons} from '../src/lessons.js';
const exec=promisify(execFile);
function codeFor(id){const w=new Blockly.Workspace();try{Blockly.serialization.workspaces.load(structuredClone(lessons.find(l=>l.id===id).state),w);return generate(w).code;}finally{w.dispose();}}
for(const lesson of lessons.filter(l=>l.state))test(`${lesson.id}: real Arduino Uno compiler`,{timeout:90000},async()=>{
 const code=codeFor(lesson.id);const response=await fetch('http://127.0.0.1:3765/api/build',{method:'POST',headers:{'Content-Type':'application/json','X-Classroom':'local'},body:JSON.stringify({code,fqbn:'arduino:avr:uno',upload:false})});
 const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));assert.equal(data.ok,true);assert.equal(data.uploaded,false);
});
test('Nano and Mega compile the complete button/servo project',{timeout:120000},async()=>{
 const folder=await mkdtemp(join(tmpdir(),'classroom-boards-'));try{const sketch=join(folder,'Classroom');await mkdir(sketch);await writeFile(join(sketch,'Classroom.ino'),codeFor('race'));
 for(const fqbn of ['arduino:avr:nano:cpu=atmega328','arduino:avr:nano:cpu=atmega328old','arduino:avr:mega:cpu=atmega2560'])await exec('arduino-cli',['compile','--fqbn',fqbn,sketch],{timeout:90000,maxBuffer:500000});
 }finally{await rm(folder,{recursive:true,force:true});}
});
test('button and sensor programs behave under debounced input sequences',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'classroom-behaviour-'));
 const header=`#pragma once\n#include <cstdint>\n#include <algorithm>\n#include <cmath>\nusing byte = uint8_t;\n#define HIGH 1\n#define LOW 0\n#define INPUT_PULLUP 2\n#define OUTPUT 1\n#define A0 14\nunsigned long nowMs=0; int pins[70]; int lightInput=0; int servoAngle=0;\nunsigned long millis(){return nowMs;}\nint digitalRead(int p){return pins[p];}\nint analogRead(int){return lightInput;}\nvoid pinMode(int,int){}\nvoid delay(unsigned long d){nowMs+=d;}\nlong map(long x,long a,long b,long c,long d){return (x-a)*(d-c)/(b-a)+c;}\ntemplate<class T> T constrain(T x,T a,T b){return x<a?a:x>b?b:x;}\nstruct SerialMock{void begin(int){} template<class T>void print(T){} template<class T>void println(T){}} Serial;\n`;
 try{
  await writeFile(join(folder,'Arduino.h'),header);await writeFile(join(folder,'Servo.h'),'#pragma once\nstruct Servo{void attach(int){} void write(int a){servoAngle=a;}};\n');
  const fixtures={
   hold:`setup();pins[2]=HIGH;loop();pins[2]=LOW;nowMs=100;loop();nowMs=110; pins[2]=HIGH;loop();nowMs=120;pins[2]=LOW;loop();nowMs=146;loop();assert(pressedAt==146);nowMs=1146;pins[2]=HIGH;loop();nowMs=1172;loop();assert(duration==1026);nowMs=1500;loop();assert(duration==1026);`,
   race:`pins[2]=pins[3]=HIGH;setup();loop();pins[3]=LOW;nowMs=100;loop();nowMs=126;loop();assert(armed==0);assert(servoAngle==0);pins[3]=HIGH;nowMs=200;loop();nowMs=226;loop();pins[2]=LOW;nowMs=300;loop();nowMs=326;loop();assert(armed==1);pins[2]=HIGH;nowMs=400;loop();nowMs=426;loop();pins[3]=LOW;nowMs=1800;loop();nowMs=1826;loop();assert(elapsedMs==1500);assert(servoAngle==90);assert(armed==0);`,
   light:`setup();assert(servoAngle==20);lightInput=700;loop();assert(servoAngle==150);lightInput=550;loop();assert(servoAngle==150);lightInput=400;loop();assert(servoAngle==20);lightInput=550;loop();assert(servoAngle==20);`
  };
  for(const [id,fixture]of Object.entries(fixtures)){const src=join(folder,id+'.cpp'),bin=join(folder,id);await writeFile(src,codeFor(id)+'\n#include <cassert>\nint main(){'+fixture+'}\n');await exec('c++',['-std=c++17','-I',folder,src,'-o',bin]);await exec(bin,[]);}
 }finally{await rm(folder,{recursive:true,force:true});}
});
test('local API rejects foreign origins, unsupported boards and missing ports',async()=>{
 const post=(body,headers={})=>fetch('http://127.0.0.1:3765/api/build',{method:'POST',headers:{'Content-Type':'application/json','X-Classroom':'local',...headers},body:JSON.stringify(body)});
 assert.equal((await post({code:'void setup(){} void loop(){}',fqbn:'x'})).status,400);
 assert.equal((await post({code:'x',fqbn:'arduino:avr:uno'},{Origin:'https://example.com'})).status,403);
 assert.equal((await post({code:'x',fqbn:'arduino:avr:uno',path:'/tmp/not-a-device',upload:true})).status,400);
 const response=await post({code:'void setup(){BROKEN} void loop(){}',fqbn:'arduino:avr:uno'});assert.equal(response.status,400);assert.match((await response.json()).error,/BROKEN/);
});
