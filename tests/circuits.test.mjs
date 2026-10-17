import test from 'node:test';
import assert from 'node:assert/strict';
import {circuitFor,boardPins,hole,rowY,netForHole,servoFromTime,lightAngle} from '../src/circuits.js';
const componentIds=new Set(['led-resistor','led-legs','ldr-part','ldr-resistor']);
function connections(id,pressed=[]){
 const scene=circuitFor(id),parent=new Map();const key=p=>p.join(',');
 function root(x){if(!parent.has(x))parent.set(x,x);if(parent.get(x)!==x)parent.set(x,root(parent.get(x)));return parent.get(x);}
 function link(a,b){parent.set(root(key(a)),root(key(b)));}
 if(scene.breadboard){for(let c=1;c<=30;c++){for(const rows of ['abcde','fghij'])for(const r of rows)link(hole(rows[0],c),hole(r,c));link([430,476],[430+(c-1)*20,476]);}}
 for(const w of scene.wires)if(!componentIds.has(w.id))link(w.from,w.to);
 for(const b of scene.buttons){link(hole('e',b.col),hole('f',b.col));link(hole('e',b.col+3),hole('f',b.col+3));if(pressed.includes(b.name))link(hole('e',b.col),hole('e',b.col+3));}
 return {same:(a,b)=>root(key(a))===root(key(b)),scene};
}
test('LED: resistor and diode form a series path without a wire bypass',()=>{
 const {same}=connections('blink');
 assert(same(boardPins.D13,hole('d',4)));
 assert(!same(hole('d',4),hole('d',8)),'resistor must not be bypassed');
 assert(same(hole('d',8),hole('e',8)));
 assert(!same(hole('e',8),hole('e',10)),'diode must not be shorted');
 assert(same(hole('e',10),boardPins.GND));
 assert(!same(boardPins.D13,boardPins.GND));
});
test('both buttons: open until pressed; A and B stay independent',()=>{
 let state=connections('race');
 assert(!state.same(boardPins.D2,boardPins.GND));assert(!state.same(boardPins.D3,boardPins.GND));
 state=connections('race',['A']);assert(state.same(boardPins.D2,boardPins.GND));assert(!state.same(boardPins.D3,boardPins.GND));
 state=connections('race',['B']);assert(!state.same(boardPins.D2,boardPins.GND));assert(state.same(boardPins.D3,boardPins.GND));
});
test('single button diagram matches D2 pull-up wiring',()=>{
 assert(!connections('hold').same(boardPins.D2,boardPins.GND));
 assert(connections('hold',['A']).same(boardPins.D2,boardPins.GND));
});
test('LDR: A0 joins divider midpoint, supply and ground remain separate',()=>{
 const {same}=connections('light');
 assert(same(boardPins['5V'],hole('e',9)));
 assert(same(boardPins.A0,hole('e',13)));
 assert(same(boardPins.A0,hole('d',13)));
 assert(same(boardPins.GND,hole('d',19)));
 assert(!same(boardPins['5V'],boardPins.A0));assert(!same(boardPins.A0,boardPins.GND));
});
test('servo: supply negative is common; external positive is separate from Arduino 5V',()=>{
 for(const id of ['servo','race','light']){const {same}=connections(id);assert(same(boardPins.D9,[855,190]));assert(same([790,550],[875,190]));assert(same(boardPins.GND,[895,190]));assert(same(boardPins.GND,[940,550]));assert(!same(boardPins['5V'],[790,550]));assert(!same([790,550],boardPins.GND));}
});
test('breadboard groups stop at trench and numbered-column boundary',()=>{
 assert.equal(netForHole('a',12),netForHole('e',12));assert.notEqual(netForHole('a',12),netForHole('f',12));assert.notEqual(netForHole('a',12),netForHole('a',13));
});
test('teaching motion uses the example timing limits and light hysteresis',()=>{
 assert.equal(servoFromTime(1500),90);assert.equal(servoFromTime(4000),180);assert.equal(servoFromTime(-2),0);
 assert.equal(lightAngle(700,20),150);assert.equal(lightAngle(550,150),150);assert.equal(lightAngle(400,150),20);assert.equal(lightAngle(550,20),20);
});
