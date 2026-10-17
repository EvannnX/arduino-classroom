// 教学图使用共享端点坐标，避免导线与孔位脱离。
export const colours={signal:'#d59a35',ground:'#3f4d55',power:'#d86154',input:'#419f91'};
export const boardPins={D13:[64,200],D12:[82,200],D11:[100,200],D10:[118,200],D9:[136,200],D8:[154,200],D7:[172,200],D6:[190,200],D5:[208,200],D4:[226,200],D3:[244,200],D2:[262,200],D1:[280,200],D0:[298,200],'5V':[120,480],GND:[156,480],A0:[246,480]};
export const rowY={a:270,b:288,c:306,d:324,e:342,f:378,g:396,h:414,i:432,j:450};
export function hole(row,col){if(!(row in rowY)||col<1||col>30)throw new Error('无效面包板孔位');return[430+(col-1)*20,rowY[row]];}
export function netForHole(row,col){return `${'abcde'.includes(row)?'upper':'lower'}-${col}`;}
const rail=col=>[430+(col-1)*20,476];
const wire=(id,from,to,colour,title,detail,via=[])=>({id,from,to,colour,title,detail,via});
const ground=()=>wire('common-ground',boardPins.GND,rail(1),'ground','Arduino GND → 蓝色 − 电源轨','蓝色标记只表示约定的地线；电源轨必须真正接到 GND 才是地。',[[156,520],[430,520]]);
const servoWires=()=>[
 wire('servo-signal',boardPins.D9,[855,190],'signal','D9 → 舵机 S（信号）','通常是橙色或黄色线。这里传送角度控制信号，不负责给舵机供电。',[[136,88],[825,88],[825,212],[855,212]]),
 wire('servo-power',[790,550],[875,190],'power','外接稳压 5V 的 + → 舵机 +','通常是红线。先确认舵机型号、电压与供电电流。Arduino 通过 USB 供电，外部正极不要并接 Arduino 5V。',[[790,535],[1048,535],[1048,205],[875,205]]),
 wire('servo-ground',[940,550],[895,190],'ground','外接电源 − → 舵机 GND','通常是棕线或黑线。信号、电源、地，三根线缺一不可。',[[940,540],[1065,540],[1065,218],[895,218]]),
 wire('servo-common',boardPins.GND,[940,550],'ground','Arduino GND → 外接电源 −（共地）','两路电源需要共同的电位参考。只连接 GND，外部 +5V 保持独立。',[[156,515],[940,515]])
];
const buttonWires=(name,col,pin)=>[
 wire(`button-${name}-signal`,boardPins[pin],hole('a',col),'input',`${pin} → 按钮 ${name} 的触点 1（a${col}）`,`a${col}～e${col} 已在面包板内部连通，所以跳线在 a${col}，按钮脚在 e${col}，仍属于同一个节点。`,[[boardPins[pin][0],name==='A'?115:140],[hole('a',col)[0],name==='A'?115:140]]),
 wire(`button-${name}-ground`,hole('j',col+3),rail(col+3),'ground',`按钮 ${name} 的触点 4（j${col+3}）→ − 电源轨`,`按钮的触点 3 / 4 是同一组；本图用 j${col+3} 接到轨道。不要把信号线和地线焊在已相通的两脚上。`)
];
export function circuitFor(id){
 const base={id,title:'Arduino Uno R3 接线图',board:true,breadboard:false,buttons:[],servo:false,wires:[],notes:[]};
 if(['blink','counter'].includes(id))return {...base,title:id==='counter'?'计数器使用板载 LED，也可外接一盏灯':'外接 LED：电阻与方向都要对',breadboard:true,led:true,wires:[
  wire('led-signal',boardPins.D13,hole('a',4),'signal','D13 → a4','a4～e4 同组；220Ω 电阻的一端插 d4。',[[64,100],[490,100],[490,210],[490,250],[490,270]]),
  wire('led-resistor',hole('d',4),hole('d',8),'signal','220Ω 电阻跨接 d4 → d8','电阻没有正负。两端必须位于不同的编号组，不能都插在同一组 a～e 中。'),
  wire('led-legs',hole('e',8),hole('e',10),'signal','LED 长脚 e8，短脚 e10','LED 长脚是阳极，接电阻；短脚 / 灯壳平边为阴极，接地。本图 LED 两脚跨开两个编号。'),
  wire('led-ground',hole('a',10),boardPins.GND,'ground','a10 → Arduino GND','a10～e10 已连通，所以短脚 e10 能通过 a10 回到 GND。板载 L 灯不需要这些外接线。',[[610,145],[352,145],[352,520],[156,520]])
 ],notes:['接线图中的 220Ω 电阻和 LED 本体画在真实孔位上，连接步骤会依次高亮。']};
 if(id==='melody')return {...base,title:'无源压电蜂鸣器：两根线',buzzer:true,wires:[wire('buzzer-signal',boardPins.D8,[700,320],'signal','D8 → 无源蜂鸣器 +','使用小型无源压电蜂鸣器；有源蜂鸣器不适合这个旋律示例。',[[154,112],[660,112],[660,320]]),wire('buzzer-ground',[780,320],boardPins.GND,'ground','蜂鸣器 − → GND','对照器件的 + 标记接线。',[[820,320],[820,520],[156,520]])]};
 if(id==='servo')return {...base,title:'舵机：信号、独立供电、共同的地',servo:true,wires:servoWires()};
 if(id==='hold'||id==='solder')return {...base,title:'上拉输入按钮：D2 与 GND',breadboard:true,buttons:[{name:'A',col:12,pin:'D2'}],wires:[ground(),...buttonWires('A',12,'D2')],notes:['本图使用 INPUT_PULLUP，不需要外接 10kΩ 上拉电阻。按下 = LOW，松开 = HIGH。']};
 if(id==='race')return {...base,title:'两个按钮计时，舵机显示结果',breadboard:true,buttons:[{name:'A',col:5,pin:'D2'},{name:'B',col:16,pin:'D3'}],servo:true,wires:[ground(),...buttonWires('A',5,'D2'),...buttonWires('B',16,'D3'),...servoWires()],notes:['先按并松开 A，再按 B。两个按钮可以共用 GND，信号分别接 D2 与 D3。']};
 if(id==='light')return {...base,title:'光敏电阻分压：先变成电压，再被读取',breadboard:true,ldr:true,servo:true,wires:[ground(),
  wire('ldr-power',boardPins['5V'],hole('a',9),'power','Arduino 5V → a9（光敏电阻一端）','光敏电阻的一脚在 e9，与 a9 同组。该 5V 只供传感器，舵机使用独立电源。',[[120,555],[350,555],[350,120],[590,120]]),
  wire('ldr-part',hole('e',9),hole('e',13),'power','光敏电阻两脚分别插 e9、e13','光敏电阻没有正负；受光后电阻通常降低。'),
  wire('ldr-resistor',hole('d',13),hole('d',19),'signal','10kΩ 电阻插 d13 → d19','d13 与 e13 同组，这就是“中间节点”；它通过 10kΩ 接地。'),
  wire('ldr-ground',hole('b',19),rail(30),'ground','b19 → − 电源轨','将 10kΩ 的另一端接地，形成 5V → 光敏电阻 → 中间节点 → 10kΩ → GND。',[[1030,288],[1030,476]]),
  wire('ldr-read',boardPins.A0,hole('c',13),'input','A0 → c13（分压的中间节点）','c13、d13、e13 互相连通。A0 读的是这个节点相对 GND 的电压。',[[246,535],[670,535]]),...servoWires()],notes:['接裸光敏电阻时使用图中的 10kΩ 分压电阻。模块 AO 接法与裸元件不同，请看右侧接线表。']};
 return {...base,title:'面包板与按钮结构',breadboard:true,board:false,wires:[]};
}
export const solderSteps=[
 {title:'先认清两组触点',text:'本图 1↔2 已相通，3↔4 已相通。只有按下，左右两组才连通。先用万用表核对你手里的按钮，脚位按型号可能不同。'},
 {title:'剥线、套管、预上锡',text:'断开 USB 和外部电源。每个按钮准备两根长线，剥出约 3～4mm 铜线并拧紧；先把热缩管套在线上，再给线头和选定脚少量预上锡。'},
 {title:'第一根信号线焊到触点 1',text:'用夹具固定按钮。先加热脚与线的连接处，再送少量焊锡；焊锡铺开后先移开焊锡，再移开烙铁。让焊点自然冷却，轻拉检查。'},
 {title:'第二根地线焊到触点 3',text:'选另一组的脚 3，而不是与 1 已相通的脚 2。按相同步骤焊接。两根线不要搭在一起，不要把锡桥接到相邻触点。'},
 {title:'冷却后绝缘与固定',text:'等待焊点冷却，将热缩管分别滑到裸露焊点并加热收缩，固定导线作应力释放。不要仅靠焊点承受拉扯。'},
 {title:'断电测通断，再接回 Arduino',text:'万用表两表笔接长线末端：松开不导通，按下导通。按钮 A 的信号线接 D2，按钮 B 接 D3；两根地线接 GND。检查后再上电。'}
];
export function servoFromTime(ms){return Math.floor(Math.min(3000,Math.max(0,ms))*180/3000);}
export function lightAngle(value,previous=20){return value>600?150:value<500?20:previous;}
