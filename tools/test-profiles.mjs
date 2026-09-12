import test from 'node:test'
import assert from 'node:assert/strict'
import {makeProfile,parseProfile,parseSavedProfiles,validateProfile,setProfileAssignment,resetProfileAssignments,profileFromCurrent} from '../src/profiles.mjs'
import {candidateKeys,mappedKeys,optionAssignment,readAssignment} from '../src/keymap.mjs'
import {actionTargets} from '../src/action-targets.mjs'
import fnReference from '../src/data/fn-reference.json' with {type:'json'}

test('current profiles accept both known slot-88 forms without altering raw snapshots or other mappings',()=>{
 const edited=setProfileAssignment(validateProfile({...makeProfile(),experimental:true}),'KeyA',0x200000)
 for(const reserved of [0,0x87]){
  const raw=Uint8Array.from(edited.keymap);raw[266]=reserved
  const saved=raw.slice()
  const profile=profileFromCurrent(raw,'读取结果')
  assert.deepEqual(raw,saved)
  assert.equal(profile.keymap[266],0x87)
  assert.equal(readAssignment(profile.keymap,10),0x200000)
  assert.ok(profile.keymap.every((byte,index)=>index===266||byte===raw[index]))
  assert.deepEqual(parseProfile(JSON.stringify(profile)),profile)
 }
 for(const [index,value] of [[264,0],[265,1],[266,1],[266,0xff]]){
  const raw=Uint8Array.from(edited.keymap);raw[index]=value
  assert.throws(()=>profileFromCurrent(raw),/槽位 88 为 .*尚未识别/)
 }
})

test('reset restores all default mappings without mutating the draft or its metadata',()=>{
 const base=validateProfile({...makeProfile('我的配置'),experimental:true})
 const edited=setProfileAssignment(setProfileAssignment(base,'KeyA',0x200000),'KeyQ',0xa0ad00)
 const saved=JSON.stringify(edited)
 const reset=resetProfileAssignments(edited)
 assert.deepEqual(reset,base)
 assert.equal(JSON.stringify(edited),saved)
 assert.deepEqual(parseProfile(JSON.stringify(reset)),base)
})

test('unassigned mapping preserves zero usage through export and restoration',()=>{
 const base=validateProfile({...makeProfile(),experimental:true})
 const disabled=setProfileAssignment(base,'KeyA',0x200000)
 assert.deepEqual(disabled.keymap.slice(30,33),[0x20,0,0])
 assert.deepEqual(parseProfile(JSON.stringify(disabled)),disabled)
 assert.deepEqual(setProfileAssignment(disabled,'KeyA',0x200004),base)
 assert.ok(disabled.keymap.every((byte,index)=>Math.floor(index/3)===10||byte===base.keymap[index]))
 assert.throws(()=>setProfileAssignment(base,'Fn',0x200000))
})

test('new actions match original Fn bytes and survive profile editing, export and restoration',()=>{
 const original=validateProfile({...makeProfile(),experimental:true})
 const sourceActions=new Set(fnReference.map(row=>parseInt(row.actionHex.replaceAll(' ',''),16)))
 assert.equal(new Set(actionTargets.map(target=>target.assignment)).size,actionTargets.length)
 for(const target of actionTargets){
  assert.ok(sourceActions.has(target.assignment),`${target.label} must have original firmware evidence`)
  const changed=setProfileAssignment(original,'KeyA',target.assignment)
  assert.deepEqual(changed.keymap.slice(30,33),[target.assignment>>>16,(target.assignment>>>8)&255,target.assignment&255])
  assert.deepEqual(parseProfile(JSON.stringify(changed)),changed)
  assert.deepEqual(setProfileAssignment(changed,'KeyA',readAssignment(original.keymap,10)),original)
  assert.ok(changed.keymap.every((byte,index)=>Math.floor(index/3)===10||byte===original.keymap[index]))
 }
 assert.throws(()=>setProfileAssignment(original,'KeyA',0xa0ff00))
})
test('A/B profiles round-trip independently and preserve full reference table',()=>{
 const a=makeProfile('默认 A',4),b=makeProfile('测试 B',5)
 assert.deepEqual(parseProfile(JSON.stringify(b)),b)
 assert.deepEqual(parseSavedProfiles(JSON.stringify([a,b])),[a,b])
 const loaded=parseProfile(JSON.stringify(b));loaded.keymap[32]=4
 assert.equal(b.keymap[32],5)
 assert.deepEqual(a.keymap.filter((_,i)=>i!==32),b.keymap.filter((_,i)=>i!==32))
 const combined=makeProfile('组合',5);combined.keymap[29]=26;combined.keymap[56]=27;combined.keymap[209]=80
 assert.deepEqual(parseProfile(JSON.stringify(combined)),combined)
})
test('modifier and media assignments keep all three bytes and reject unknown categories',()=>{
 const p=makeProfile(),alt=setProfileAssignment(p,'ControlLeft',0x200400),mute=setProfileAssignment(alt,'F1',0x30e200)
 assert.deepEqual(mute.keymap.slice(15,18),[0x20,4,0])
 assert.deepEqual(mute.keymap.slice(21,24),[0x30,0xe2,0])
 assert.deepEqual(parseProfile(JSON.stringify(mute)),mute)
 assert.deepEqual(p.keymap.slice(15,18),[0x20,1,0])
 assert.throws(()=>setProfileAssignment(mute,'F1',0x30e900))
 assert.throws(()=>setProfileAssignment(mute,'ControlLeft',0x30e200))
})
test('experimental layouts keep provenance, protect unresolved slots and round-trip all candidates',()=>{
 assert.equal(candidateKeys.length,82)
 assert.equal(new Set(candidateKeys.map(k=>k.slot)).size,82)
 assert.equal(candidateKeys.some(k=>k.code==='Fn'),false)
 for(const key of mappedKeys)assert.equal(candidateKeys.find(k=>k.code===key.code).slot,key.slot)
 const original=makeProfile(),base=validateProfile({...original,experimental:true})
 for(const key of candidateKeys){
  const changed=setProfileAssignment(base,key.code,0x30e200)
  assert.equal(readAssignment(changed.keymap,key.slot),0x30e200)
  assert.deepEqual(parseProfile(JSON.stringify(changed)),changed)
  assert.ok(changed.keymap.every((b,i)=>Math.floor(i/3)===key.slot||b===original.keymap[i]))
 }
 const changed=setProfileAssignment(base,'KeyW',0x200004)
 assert.throws(()=>validateProfile({...changed,experimental:false}))
 assert.throws(()=>setProfileAssignment(base,'Fn',0x200004))
 const reserved={...base,keymap:[...base.keymap]};reserved.keymap[266]=0
 assert.throws(()=>validateProfile(reserved))
 assert.throws(()=>validateProfile({...base,experimental:'true'}))
 assert.ok(candidateKeys.every(k=>k.options.every(o=>Number.isInteger(optionAssignment(o)))))
})
test('reject incompatible, unsupported or malformed imports without coercing bytes',()=>{
 const base=makeProfile()
 for(const change of [{version:2},{device:'other'},{name:''},{keymap:[]},{keymap:base.keymap.map((v,i)=>i===32?'5':v)},{keymap:base.keymap.map((v,i)=>i===0?0:v)},{keymap:base.keymap.map((v,i)=>i===32?6:v)}])assert.throws(()=>validateProfile({...base,...change}))
 assert.throws(()=>parseProfile(' '.repeat(32769)))
 assert.throws(()=>parseSavedProfiles(JSON.stringify([base,base])))
 assert.throws(()=>parseSavedProfiles('{}'))
})
