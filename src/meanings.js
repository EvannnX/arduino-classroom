// Visible lesson language is separate from stable C++ identifiers in saved projects.
export const recordLabels={
 count:'当前计数',pressedAt:'按下时刻',duration:'按住时长',
 startedAt:'按下 A 的时刻',elapsedMs:'A 到 B 的用时',armed:'计时开关（1 开，0 关）',lightValue:'光线读数'
};
export const serialLabels={
 'count: ':'当前计数：','duration_ms: ':'按住时长（毫秒）：',
 'started_at: ':'开始时刻（毫秒）：','elapsed_ms: ':'A 到 B 的用时（毫秒）：','light: ':'光线读数：'
};
export function readableRecord(value){return recordLabels[value]||String(value);}
export function readableSerial(value){return serialLabels[value]||String(value);}
export function internalRecord(value){const item=Object.entries(recordLabels).find(([,label])=>label===value);return item?item[0]:String(value);}
export function cppIdentifier(value){const name=String(value);if(/[\u3400-\u9fff]/u.test(name)&&/^[\p{L}_][\p{L}\p{N}_]{0,31}$/u.test(name))return 'classroomUser_'+[...name].map(c=>c.codePointAt(0).toString(16)).join('_');return name;}
export const recordExplanations={
 pressedAt:'按下按钮那一刻，Arduino 从开机起已经数过的毫秒数。记住它，松开时才能做减法。',
 duration:'从按下到松开，经过了多少毫秒。它是两个计时读数相减的结果。',
 count:'程序目前数到了几。每加 1，就会记住这个新的数。',
 startedAt:'按下按钮 A 那一刻的计时读数，用来和按下 B 时的读数相减。',
 elapsedMs:'按下 B 时的读数，减去按下 A 时记住的读数。',
 armed:'1 表示已经按过 A，正在等 B；0 表示还没开始或已经结束。',
 lightValue:'Arduino 从光线传感器读到的数字。数值如何随光变化取决于接法。'
};
export function holdExplanation(){return `<section class="meaning-explainer"><div class="meaning-intro"><strong>按下时刻与按住时长，是两个不同的数。</strong><span>Arduino 开机后一直数毫秒。按下时记一次，松开时再读一次，相减就知道按了多久。程序记住、后面还能再使用的数，叫“变量”。</span></div><div class="time-example" aria-label="计时示例：按下读到2000毫秒，松开读到3500毫秒，相减等于1500毫秒，也就是1.5秒"><div class="time-example-start"><b>① 按下按钮</b><strong>2000 <small>毫秒</small></strong><span>记为“按下时刻”</span></div><span class="time-example-arrow" aria-hidden="true">→</span><div class="time-example-end"><b>② 松开按钮</b><strong>3500 <small>毫秒</small></strong><span>读取这时的计时数字</span></div><span class="time-example-arrow" aria-hidden="true">→</span><div class="time-example-result"><b>③ 算出按住时长</b><strong>3500 − 2000 = 1500</strong><span>1500 毫秒 = 1.5 秒</span></div></div><p>上面是帮助理解的示例数字。下面的积木会记录你实际按下、松开的时刻。这里的“时刻”是从开机起的计时读数，不是几点几分。</p></section>`;}
