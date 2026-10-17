import * as BlocklyModule from 'blockly/core';
const Blockly = Reflect.get(BlocklyModule, 'default') || BlocklyModule;
import 'blockly/blocks';
import {palette} from './beginner.js';
import {readableRecord,readableSerial,internalRecord,cppIdentifier,recordExplanations} from './meanings.js';
import * as Zh from 'blockly/msg/zh-hans';
Blockly.setLocale({...Zh,CONTROLS_IF_MSG_IF:'如果',CONTROLS_IF_MSG_THEN:'就做',CONTROLS_IF_MSG_ELSE:'否则就做',CONTROLS_REPEAT_TITLE:'重复 %1 次',CONTROLS_REPEAT_INPUT_DO:'做这些动作'});
class RecordMeaningField extends Blockly.FieldTextInput {
  getText_(){return super.getText_() ?? readableRecord(this.getValue());}
  getEditorText_(value){return readableRecord(value);}
  getValueFromEditorText_(value){return internalRecord(value);}
  static fromJson(options){return new RecordMeaningField(options.text||'count');}
}
class SerialMeaningField extends Blockly.FieldTextInput {
  getText_(){return super.getText_() ?? readableSerial(this.getValue());}
  getEditorText_(value){return readableSerial(value);}
  getValueFromEditorText_(value){return String(value);}
  static fromJson(options){return new SerialMeaningField(options.text||'数值：');}
}
Blockly.fieldRegistry.register('field_record_meaning',RecordMeaningField);
Blockly.fieldRegistry.register('field_serial_meaning',SerialMeaningField);
const record=(value='count')=>({type:'field_record_meaning',name:'VAR',text:value});
const number=(name,value=0,min=0,max=65535)=>({type:'field_number',name,value,min,max,precision:1});
const text=(name,value)=>({type:'field_input',name,text:value});
const input=(name,check='Number')=>({type:'input_value',name,check});
const statement=name=>({type:'input_statement',name});
const dropdown=(name,options)=>({type:'field_dropdown',name,options});
const pin=()=>number('PIN',13,0,69);
const colourFor=n=>({205:palette.input,32:palette.output,190:palette.time,275:palette.variable,160:palette.variable,230:palette.math}[n]||n);
const stmt=(type,message0,args0,colour,extra={})=>({type,message0,args0,colour:colourFor(colour),previousStatement:null,nextStatement:null,inputsInline:true,...extra});
const expr=(type,message0,args0,colour,output='Number')=>({type,message0,args0,colour:colourFor(colour),output,inputsInline:true});
Blockly.defineBlocksWithJsonArray([
 {type:'program',message0:'开始时（只做一次） %1 一直重复 %2',args0:[statement('SETUP'),statement('LOOP')],colour:palette.start,tooltip:'setup 只执行一次；loop 会不断从头执行。'},
 stmt('pin_mode','准备 %1 号引脚：%2',[pin(),dropdown('MODE',[['控制元件（输出）','OUTPUT'],['读取元件（输入）','INPUT'],['读取按钮（上拉）','INPUT_PULLUP']])],205),
 stmt('led','让 %1 号引脚的灯 %2',[pin(),dropdown('STATE',[['亮起来（HIGH）','HIGH'],['熄灭（LOW）','LOW']])],32),
 stmt('pwm','让 %1 号引脚的灯，亮度变成 %2',[number('PIN',5,0,69),input('VALUE')],32),
 stmt('wait','停一会儿 %1 毫秒',[input('MS')],190),
 stmt('print','在电脑上显示 %1',[input('VALUE',null)],160,{message1:'结果前写上 %1',args1:[{type:'field_serial_meaning',name:'LABEL',text:'数值：'}],inputsInline:false}),
 stmt('tone_note','让 %1 号蜂鸣器发声，音高 %2 Hz，持续 %3 毫秒',[number('PIN',8,0,69),input('FREQ'),input('MS')],32),
 stmt('no_tone','让 %1 号蜂鸣器安静下来',[number('PIN',8,0,69)],32),
 stmt('servo_attach','准备舵机：信号线接 %1 号引脚',[number('PIN',9,0,69)],32),
 stmt('servo_move','让舵机转到 %1 度',[input('ANGLE')],32),
 stmt('var_set','记住 %1',[record()],275,{message1:'数值是 %1',args1:[input('VALUE',null)],inputsInline:false}),
 stmt('var_change','让 %1 增加 %2',[record(),input('VALUE')],275),
 expr('var_get','%1',[record()],275),
 expr('clock','此刻的计时读数（毫秒）',[],190),
 expr('elapsed','此刻的计时读数 − %1',[input('SINCE')],190),
 expr('analog','读取 %1 的传感器数字',[dropdown('PIN',Array.from({length:6},(_,i)=>['A'+i,'A'+i]))],205),
 expr('digital','读取 %1 号引脚：1 或 0',[number('PIN',2,0,69)],205),
 stmt('button_update','检查 %1 号按钮的按下和松开',[number('PIN',2,0,69)],205,{tooltip:'每轮 loop 调用一次。按钮接引脚和 GND；按下为 LOW。'}),
 expr('button_event','%1 号按钮 %2',[number('PIN',2,0,69),dropdown('EVENT',[['刚刚按下','pressed'],['刚刚松开','released'],['仍然按住','down']])],205,'Boolean'),
 expr('map_value','把 %1 从范围 %2 ～ %3 换算到 %4 ～ %5',[input('VALUE'),number('FROM_MIN',0,-100000,100000),number('FROM_MAX',1023,-100000,100000),number('TO_MIN',0,-100000,100000),number('TO_MAX',180,-100000,100000)],230),
 expr('limit','把 %1 保持在 %2 ～ %3 之间',[input('VALUE'),number('MIN',0,-100000,100000),number('MAX',180,-100000,100000)],230)
]);
export {Blockly};
export const toolbox={kind:'categoryToolbox',contents:[
 {kind:'category',name:'输入与按钮',colour:205,contents:['pin_mode','analog','digital','button_update','button_event'].map(type=>({kind:'block',type}))},
 {kind:'category',name:'灯光 / 声音 / 舵机',colour:32,contents:[{kind:'block',type:'led'},{kind:'block',type:'pwm',inputs:{VALUE:{shadow:{type:'math_number',fields:{NUM:128}}}}},{kind:'block',type:'tone_note',inputs:{FREQ:{shadow:{type:'math_number',fields:{NUM:440}}},MS:{shadow:{type:'math_number',fields:{NUM:300}}}}},{kind:'block',type:'no_tone'},{kind:'block',type:'servo_attach'},{kind:'block',type:'servo_move',inputs:{ANGLE:{shadow:{type:'math_number',fields:{NUM:90}}}}}]},
 {kind:'category',name:'变量与串口',colour:275,contents:['var_set','var_change','var_get','print'].map(type=>({kind:'block',type}))},
 {kind:'category',name:'条件与逻辑',colour:210,contents:['controls_if','logic_compare','logic_operation','logic_negate','logic_boolean'].map(type=>({kind:'block',type}))},
 {kind:'category',name:'数字与运算',colour:230,contents:['math_number','math_arithmetic','map_value','limit'].map(type=>({kind:'block',type}))},
 {kind:'category',name:'时间与重复',colour:190,contents:[{kind:'block',type:'clock'},{kind:'block',type:'elapsed'},{kind:'block',type:'wait',inputs:{MS:{shadow:{type:'math_number',fields:{NUM:500}}}}},{kind:'block',type:'controls_repeat_ext',inputs:{TIMES:{shadow:{type:'math_number',fields:{NUM:3}}}}}]}
]};
const reserved=new Set('setup loop main millis delay Serial HIGH LOW INPUT OUTPUT INPUT_PULLUP true false int long float bool double unsigned signed void char short const for if else while return switch case class struct auto new delete sizeof null nullptr servo counter ButtonState tone noTone map constrain pinMode digitalWrite digitalRead analogRead analogWrite'.split(' '));
function variable(block){const name=cppIdentifier(block.getFieldValue('VAR'));if(name.startsWith('classroomUser_')&&/[\u3400-\u9fff]/u.test(String(block.getFieldValue('VAR'))))return name;if(!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(name)||reserved.has(name)||name.startsWith('classroom'))throw new Error(`变量名“${name}”请使用文字开头的中文、英文、数字或下划线，不要使用程序保留的名称。`);return name;}
function cppString(text){return '"'+String(text).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/\t/g,'\\t').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'')+'"';}
export function generate(workspace){
 const roots=workspace.getTopBlocks(true).filter(b=>b.isEnabled());
 const programs=roots.filter(b=>b.type==='program');
 if(programs.length!==1)throw new Error('请保留一块“开始时 / 一直重复”积木，把动作接在里面。');
 const program=programs[0];
 const active=program.getDescendants(false).filter(b=>b.isEnabled());
 const vars=new Set(),buttons=new Set(),updates=new Set();let servo=false,servoPin=null;
 for(const b of active){
  if(['var_set','var_change','var_get'].includes(b.type)){vars.add(variable(b));b.setTooltip(recordExplanations[b.getFieldValue('VAR')]||'这是程序记住的一个数字，可以在后面的动作中使用。');}
  if(['button_update','button_event'].includes(b.type))buttons.add(b.getFieldValue('PIN'));
  if(b.type==='button_update')updates.add(b.getFieldValue('PIN'));
  if(b.type==='servo_attach'){servo=true;if(servoPin!==null && servoPin!==b.getFieldValue('PIN'))throw new Error('此课堂支持一个舵机，请使用同一个信号引脚。');servoPin=b.getFieldValue('PIN');}
  if(b.type==='servo_move')servo=true;
 }
 if(servo&&servoPin===null)throw new Error('先把“准备舵机”积木放进“开始时”，再让舵机转动。');
 for(const p of buttons)if(!updates.has(p))throw new Error(`先在“一直重复”开头放一块“看一眼 ${p} 号按钮”积木。`);
 const warnings=roots.filter(b=>b!==program).length?['有积木还没有接进程序。把它接到“开始时”或“一直重复”里面，才会执行。']:[];
 if(active.some(b=>b.type==='wait')&&buttons.size)warnings.push('按钮计时中使用等待会错过动作；尽量改用 millis() 判断。');
 if(servo&&active.some(b=>b.type==='pwm'&&[9,10].includes(b.getFieldValue('PIN'))))warnings.push('Uno / Nano 的 Servo 库占用 Timer1，避免同时使用 9、10 脚 PWM。');
 if(active.some(b=>b.type==='tone_note')&&active.some(b=>b.type==='pwm'&&[3,11].includes(b.getFieldValue('PIN'))))warnings.push('Uno / Nano 的 tone() 会影响 3、11 脚 PWM。');
 function value(b,name,fallback='0'){const c=b.getInputTargetBlock(name);return c?expression(c):fallback;}
 function expression(b){
  if(!b.isEnabled())return '0';const f=n=>b.getFieldValue(n);
  switch(b.type){
   case 'math_number':return String(f('NUM'));
   case 'var_get':return variable(b);
   case 'clock':return 'millis()';
   case 'elapsed':return `(unsigned long)(millis() - ${value(b,'SINCE')})`;
   case 'analog':return `analogRead(${f('PIN')})`;
   case 'digital':return `digitalRead(${f('PIN')})`;
   case 'button_event':return `classroomButton${f('PIN')}.${f('EVENT')}`;
   case 'logic_boolean':return f('BOOL')==='TRUE'?'true':'false';
   case 'logic_negate':return `(!${value(b,'BOOL','false')})`;
   case 'logic_compare':return `(${value(b,'A')} ${{EQ:'==',NEQ:'!=',LT:'<',LTE:'<=',GT:'>',GTE:'>='}[f('OP')]} ${value(b,'B')})`;
   case 'logic_operation':return `(${value(b,'A','false')} ${f('OP')==='AND'?'&&':'||'} ${value(b,'B','false')})`;
   case 'math_arithmetic':return f('OP')==='POWER'?`pow(${value(b,'A')}, ${value(b,'B')})`:`(${value(b,'A')} ${{ADD:'+',MINUS:'-',MULTIPLY:'*',DIVIDE:'/'}[f('OP')]} ${value(b,'B')})`;
   case 'map_value':if(f('FROM_MIN')===f('FROM_MAX'))throw new Error('映射的输入上下限不能相同。');return `map((long)(${value(b,'VALUE')}), ${f('FROM_MIN')}, ${f('FROM_MAX')}, ${f('TO_MIN')}, ${f('TO_MAX')})`;
   case 'limit':if(f('MIN')>f('MAX'))throw new Error('限制的下限不能大于上限。');return `constrain((long)(${value(b,'VALUE')}), ${f('MIN')}L, ${f('MAX')}L)`;
   default:throw new Error(`暂不支持数值积木：${b.type}`);
  }
 }
 function chain(start,indent='  '){let code='';for(let b=start;b;b=b.getNextBlock()){if(!b.isEnabled())continue;code+=command(b,indent);}return code;}
 function body(b,input,indent){return chain(b.getInputTargetBlock(input),indent+'  ');}
 function command(b,i){const f=n=>b.getFieldValue(n),v=(n,d)=>value(b,n,d);switch(b.type){
  case 'pin_mode':return `${i}pinMode(${f('PIN')}, ${f('MODE')});\n`;
  case 'led':return `${i}digitalWrite(${f('PIN')}, ${f('STATE')});\n`;
  case 'pwm':return `${i}analogWrite(${f('PIN')}, constrain((long)(${v('VALUE')}), 0L, 255L));\n`;
  case 'wait':return `${i}delay(${v('MS')});\n`;
  case 'print':return `${i}Serial.print(${cppString(readableSerial(f('LABEL')))});\n${i}Serial.println(${v('VALUE')});\n`;
  case 'tone_note':return `${i}tone(${f('PIN')}, ${v('FREQ')}, ${v('MS')});\n`;
  case 'no_tone':return `${i}noTone(${f('PIN')});\n`;
  case 'servo_attach':return `${i}classroomServo.attach(${f('PIN')});\n`;
  case 'servo_move':return `${i}classroomServo.write(constrain((long)(${v('ANGLE')}), 0L, 180L));\n`;
  case 'var_set':return `${i}${variable(b)} = ${v('VALUE')};\n`;
  case 'var_change':return `${i}${variable(b)} += ${v('VALUE')};\n`;
  case 'button_update':return `${i}classroomButton${f('PIN')}.update(${f('PIN')});\n`;
  case 'controls_if':{let code='',n=0;while(b.getInput('IF'+n)){code+=`${i}${n?'else if':'if'} (${v('IF'+n,'false')}) {\n${body(b,'DO'+n,i)}${i}}`;n++;if(b.getInput('IF'+n))code+=' ';}if(b.getInput('ELSE'))code+=` else {\n${body(b,'ELSE',i)}${i}}`;return code+'\n';}
  case 'controls_repeat_ext':return `${i}for (long classroomIndex${b.id.replace(/[^a-zA-Z0-9]/g,'')} = 0; classroomIndex${b.id.replace(/[^a-zA-Z0-9]/g,'')} < ${v('TIMES')}; ++classroomIndex${b.id.replace(/[^a-zA-Z0-9]/g,'')}) {\n${body(b,'DO',i)}${i}}\n`;
  default:throw new Error(`暂不支持指令积木：${b.type}`);
 }}
 const helper=buttons.size?`// 上拉按钮：按下 LOW。稳定 25ms 后产生一次按下 / 松开事件。\nstruct ClassroomButtonState {\n  bool raw = HIGH, stable = HIGH;\n  bool pressed = false, released = false, down = false;\n  unsigned long changedAt = 0;\n  void update(byte pin) {\n    pressed = released = false;\n    bool reading = digitalRead(pin);\n    if (reading != raw) { raw = reading; changedAt = millis(); }\n    if ((unsigned long)(millis() - changedAt) >= 25 && stable != raw) {\n      stable = raw;\n      pressed = (stable == LOW);\n      released = (stable == HIGH);\n    }\n    down = (stable == LOW);\n  }\n};\n${[...buttons].map(p=>`ClassroomButtonState classroomButton${p};`).join('\n')}\n\n`:'';
 return {code:`// 物理计算实验室 | 自动生成的 Arduino 程序\n// 串口波特率：9600。变量使用 unsigned long，适合毫秒计时与非负计数。\n#include <Arduino.h>\n${servo?'#include <Servo.h>\nServo classroomServo;\n':''}\n${[...vars].map(n=>`unsigned long ${n} = 0;`).join('\n')}\n\n${helper}void setup() {\n  Serial.begin(9600);\n${[...buttons].map(p=>`  pinMode(${p}, INPUT_PULLUP);\n`).join('')}${body(program,'SETUP','')}\n}\n\nvoid loop() {\n${body(program,'LOOP','')}\n}\n`,warnings};
}
