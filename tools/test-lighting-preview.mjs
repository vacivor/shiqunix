import test from 'node:test'
import assert from 'node:assert/strict'
import {previewLight,defaultPreviewSettings,colorSelectable} from '../src/lighting-preview.ts'

const settings={...defaultPreviewSettings(),brightness:100,speed:100* .7/2.2}
const light=(effect,x,y,time,overrides={},pulses=[],code='KeyA')=>previewLight(effect,code,x,y,time,{...settings,...overrides},pulses)

test('wave travels right, spectrum stays uniform, constant light does not animate',()=>{
 assert.equal(light(1,5,1,0).color,light(1,5+85/23,1,1).color)
 assert.equal(light(2,1,0,2).color,light(2,14,5,2).color)
 assert.notEqual(light(2,1,0,0).color,light(2,1,0,2).color)
 assert.deepEqual(light(6,2,1,0),light(6,2,1,100))
})
test('breathing reaches dark between color changes; per-key bloom stays lit',()=>{
 assert.equal(light(3,0,0,0).opacity,0)
 assert.ok(light(3,0,0,1.75).opacity>.99)
 assert.equal(light(3,0,0,3.49).opacity,0)
 assert.equal(light(3,0,0,3.51).opacity,0)
 assert.notEqual(light(3,0,0,3.49).color,light(3,0,0,3.51).color)
 assert.equal(light(7,1,0,0).opacity,1)
 assert.notEqual(light(7,1,0,0).color,light(7,1,0,1).color)
 assert.notEqual(light(7,1,0,1).color,light(7,2,0,1).color)
})
test('reactive pulses fade independently and ripple reaches remote keys later in the same color',()=>{
 const pulses=[{code:'KeyA',x:0,y:0,time:0,hue:120},{code:'KeyB',x:4,y:0,time:.2,hue:240}]
 assert.ok(light(4,0,0,.3,{},pulses,'KeyA').opacity>0)
 assert.ok(light(4,4,0,.3,{},pulses,'KeyB').opacity>0)
 assert.equal(light(4,2,0,.3,{},pulses,'KeyC').opacity,0)
 assert.equal(light(4,0,0,2,{},pulses).opacity,0)
 const first=pulses.slice(0,1)
 assert.equal(light(5,5,0,.1,{},first).opacity,0)
 assert.ok(light(5,5,0,.6,{},first).opacity>0)
 assert.equal(light(5,5,0,.6,{},first).color,light(5,0,0,.1,{},first).color)
})
test('brightness and custom off suppress light, color controls follow supported preview modes',()=>{
 for(let mode=1;mode<=8;mode++)assert.equal(light(mode,1,1,1,{brightness:0}).opacity,0)
 assert.equal(light(8,1,1,1,{enabled:false}).opacity,0)
 assert.equal(light(8,1,1,1,{color:'#ff0000'}).color,'#ff0000')
 assert.deepEqual([1,2,3,4,5,6,7,8].filter(colorSelectable),[1,4,5,6,8])
})
