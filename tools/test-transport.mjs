import test from 'node:test'
import assert from 'node:assert/strict'
import {A80Client,observedConfig,isCompatibleDevice} from '../src/transport.mjs'
import {crc16} from '../src/protocol.mjs'
import {readFileSync} from 'node:fs'
import {lightingName} from '../src/lighting.mjs'
import {systemModeName,systemModeKeyNote} from '../src/system-mode.mjs'
import {patchAKey,encodeKeymapWrite} from '../src/keymap.mjs'
import {makeProfile,setProfileAssignment,profileFromCurrent} from '../src/profiles.mjs'
import {decodeLightingSettings,applyLightingSettings,customLightingBlock} from '../src/lighting-settings.mjs'
import {buildRequest} from '../src/protocol.mjs'

test('lighting parameter writes and custom fragments reproduce the captured experiment',()=>{
 const {transactions}=JSON.parse(readFileSync(new URL('../../docs/a80-light-parameters-02/transactions.json',import.meta.url)))
 for(const tx of transactions.filter(t=>t.command===6)) {
  const wire=Uint8Array.from(tx.requestHex.split(' ').map(v=>parseInt(v,16)))
  const payload=wire.slice(8,34), before=payload.slice();before[16]=2
  const encoded=applyLightingSettings(before,payload[1],decodeLightingSettings(before))
  assert.deepEqual(buildRequest({command:6,length:26,payload:encoded}),wire.slice(1))
 }
 for(const [packet,color,enabled] of [[1495,'#ff262a',true],[1515,'#ff262a',false],[1597,'#0021ff',true]]) {
  const config=applyLightingSettings(observedConfig,8,{brightness:100,speed:100,colorMode:'single',color,enabled})
  const block=customLightingBlock(config,enabled)
  const start=transactions.findIndex(t=>t.packet===packet)
  for(const tx of transactions.slice(start,start+5)) {
   const {length,offset}=tx
   const encoded=buildRequest({command:11,length,offset,payload:block.slice(offset,offset+length),padding:length===49?block.slice(217,224):new Uint8Array()})
   assert.deepEqual(encoded,Uint8Array.from(tx.requestHex.split(' ').map(v=>parseInt(v,16))).slice(1))
  }
 }
})

test('parameters apply on the same mode; custom sends five acknowledged fragments',async()=>{
 const d=new Device(),c=clientFor(d)
 const settings={brightness:25,speed:75,colorMode:'single',color:'#ff262a',enabled:true}
 const result=await c.setLighting(2,settings)
 assert.equal(result.config[2],1);assert.equal(result.config[3],1)
 assert.equal(result.config[5],1) // Spectrum preserves the unsupported color setting.
 d.sent=[]
 const custom=await c.setLighting(8,settings)
 assert.equal(custom.verification,'custom-echo-only')
 assert.deepEqual(d.sent.map(r=>r[2]),[5,5,1,6,2,5,5,11,11,11,11,11])
 const count=d.sent.length
 await assert.rejects(c.setLighting(8,{...settings,brightness:13}),/五档/)
 assert.ok(d.sent.slice(count).every(r=>r[2]===5))
 await c.close()
})

class Device extends EventTarget {
 opened=true; vendorId=0x05ac; productId=0x024f; sent=[]; config=observedConfig.slice(); silent=false; corrupt=false; osMode=0
 collections=[{usagePage:0xff1c,inputReports:[{reportId:4,items:[{reportSize:8,reportCount:63}]}],outputReports:[{reportId:4,items:[{reportSize:8,reportCount:63}]}]}]
 emit(data,reportId=4){const event=new Event('inputreport');Object.assign(event,{reportId,data:new DataView(data.buffer,data.byteOffset,data.byteLength)});this.dispatchEvent(event)}
 async close(){this.opened=false}
 async sendReport(id,request){
  assert.equal(id,4);this.sent.push(request.slice());if(this.silent)return
  const response=request.slice(),command=request[2],length=request[3],offset=request[4]|request[5]<<8
  if([3,5,7,8,0x1b].includes(command)){
   const crc=crc16(request.subarray(2));response[0]=crc>>8;response[1]=crc&255
   if(command===5&&length===1&&offset===44)response[7]=this.osMode
   else if(command===5&&length===26)response.set(this.config,7)
   else for(let i=0;i<length;i++)response[7+i]=(offset+i)&255
  }else if(command===0xf0)response[7]=255
  else if(command===6&&!this.corrupt){this.config=request.slice(7,33);this.config[16]=2}
  this.emit(new Uint8Array(5));this.emit(response,1)
  const unrelated=response.slice();unrelated[2]=0xaa;this.emit(unrelated)
  this.emit(response)
 }
}
const clientFor=d=>new A80Client(d,{gap:0,timeout:40})

test('user configuration with FF color flag and reserved 08 preserves untouched bytes',async()=>{
 const d=new Device(),c=clientFor(d)
 d.config=Uint8Array.from('00 01 04 02 00 ff ff 01 00 08 00 00 00 00 00 00 02 00 00 00 00 00 00 00 00 00'.split(' ').map(v=>parseInt(v,16)))
 const before=d.config.slice()
 const settings={...decodeLightingSettings(before),brightness:50}
 const result=await c.setLighting(1,settings)
 const expected=before.slice();expected[2]=2
 assert.deepEqual(result.config,expected)
 const edited=await c.setLighting(1,{...settings,colorChanged:true,colorMode:'single',color:'#123456'})
 assert.equal(edited.config[5],0)
 assert.deepEqual(edited.config.slice(6,9),Uint8Array.of(0x12,0x34,0x56))
 assert.equal(edited.config[9],8)
 await c.close()
})

test('read-only Fn reference matches all 29 extracted firmware entries and editable layout slots',()=>{
 const rows=JSON.parse(readFileSync(new URL('../src/data/fn-reference.json',import.meta.url)))
 const firmware=JSON.parse(readFileSync(new URL('../docs/firmware-analysis/tables.json',import.meta.url))).specialTables['0x29c58']
 const layout=JSON.parse(readFileSync(new URL('../src/data/layout-candidates.json',import.meta.url)))
 assert.equal(rows.length,29);assert.equal(new Set(rows.map(r=>r.code)).size,29)
 for(const row of rows){
  const source=firmware[row.index]
  assert.equal(source.key,row.code);assert.equal(source.slot,row.slot)
  assert.equal(source.bytes.slice(3).toUpperCase(),row.actionHex)
  assert.equal(layout.find(key=>key.code===row.code).slot,row.slot)
 }
 assert.equal(rows.find(row=>row.code==='F10').actionHex,'30 E2 00')
})

test('snapshot refresh follows Windows/Mac/Windows and retains unknown mode without writing',async()=>{
 const d=new Device(),c=clientFor(d)
 for(const value of [0,1,0,255]){
  d.osMode=value
  const snapshot=await c.readSnapshot()
  assert.equal(snapshot.osMode,value)
  assert.ok(Number.isFinite(Date.parse(snapshot.osModeReadAt)))
 }
 assert.ok(d.sent.every(r=>![6,9].includes(r[2])))
 assert.equal(systemModeName(255),'未知模式（FF）')
 assert.equal(systemModeName(undefined),'未读取')
 assert.equal(systemModeName(0),'Windows');assert.equal(systemModeName(1),'Mac')
 await c.close()
})

test('Mac notes are tied to four physical modifiers and ordinary actions only',()=>{
 assert.match(systemModeKeyNote(1,'MetaLeft',0x200004),/输出左 Alt/)
 assert.match(systemModeKeyNote(1,'AltLeft',0x200004),/输出左 Win/)
 assert.match(systemModeKeyNote(1,'AltRight',0x200004),/输出右 Win/)
 assert.match(systemModeKeyNote(1,'ControlRight',0x200004),/输出右 Alt/)
 assert.equal(systemModeKeyNote(1,'KeyA',0x200800),'')
 assert.equal(systemModeKeyNote(0,'MetaLeft',0x200004),'')
 assert.equal(systemModeKeyNote(255,'MetaLeft',0x200004),'')
 assert.match(systemModeKeyNote(1,'MetaLeft',0x30e200),/尚未验证/)
 assert.match(systemModeKeyNote(1,'MetaLeft',undefined),/尚未读取/)
 assert.match(systemModeKeyNote(0,'Fn',undefined),/暂不支持编辑/)
})

test('mode probe reads only the candidate byte and preserves unknown values',async()=>{
 for(const value of [0,1,0xff]){
  const d=new Device(),c=clientFor(d)
  d.sendReport=async(id,request)=>{
   assert.equal(id,4);d.sent.push(request.slice())
   const response=request.slice(),crc=crc16(request.subarray(2))
   response[0]=crc>>8;response[1]=crc&255;response[7]=value;d.emit(response)
  }
  assert.equal(await c.readOsModeProbe(),value)
  assert.equal(d.sent.length,1)
  const request=d.sent[0]
  assert.deepEqual(Array.from(request.slice(2,7)),[5,1,44,0,0])
  assert.ok(request.subarray(7).every(b=>b===0))
  await c.close()
 }
})

test('experimental 08 assembles all 273 bytes without reference reads or configuration writes',async()=>{
 const d=new Device(),c=clientFor(d)
 const result=await c.readCurrentKeymap()
 assert.deepEqual(result,Uint8Array.from({length:273},(_,i)=>i&255))
 assert.deepEqual(d.sent.map(r=>r[2]),[1,8,8,8,8,8,2])
 assert.deepEqual(d.sent.filter(r=>r[2]===8).map(r=>[r[4]|r[5]<<8,r[3]]),[[0,56],[56,56],[112,56],[168,56],[224,49]])
 assert.ok(d.sent.every(r=>r.subarray(7).every(b=>b===0)))
 await c.close()
})

test('08 echo or incomplete response never becomes a successful current keymap',async()=>{
 for(const responseKind of ['echo','silence']){
  const d=new Device(),c=clientFor(d),send=d.sendReport.bind(d)
  d.sendReport=async(id,request)=>{
   if(request[2]!==8)return send(id,request)
   d.sent.push(request.slice())
   if(responseKind==='echo')d.emit(request.slice())
  }
  await assert.rejects(c.readCurrentKeymap(),/应答超时/)
  assert.deepEqual(d.sent.map(r=>r[2]),[1,8])
  await assert.rejects(c.readCurrentKeymap(),/连接已失效/)
  await c.close()
 }
})

class KeyDevice extends Device {
 keymap=new Uint8Array(readFileSync(new URL('../docs/a80-keymap-01/command-07.bin',import.meta.url)))
 reference=this.keymap.slice()
 constructor(){super();this.keymap[266]=0}
 damage=false;dropWrite=false
 async sendReport(id,request){
  const offset=request[4]|request[5]<<8,length=request[3]
  if([7,8].includes(request[2])){
   this.sent.push(request.slice());const response=request.slice(),crc=crc16(request.subarray(2))
   response[0]=crc>>8;response[1]=crc&255;response.set((request[2]===7?this.reference:this.keymap).slice(offset,offset+length),7);this.emit(response);return
  }
  if(request[2]===9){
   if(this.dropWrite){this.sent.push(request.slice());return}
   this.keymap.set(request.slice(7,7+length),offset)
   if(this.damage&&offset===224)this.keymap[266]=1
  }
  return super.sendReport(id,request)
 }
}
test('A/B transactions match official writes; restoration is sent even when 07 already says A',async()=>{
 const d=new KeyDevice(),client=clientFor(d),before=d.keymap.slice();let reference
 const first=await client.setAKey(5,data=>{reference=data;assert.equal(d.sent.filter(t=>t[2]===9).length,0)})
 assert.deepEqual(reference,before);assert.equal(first.verification,'readback-08')
 assert.equal(first.changed,undefined);assert.deepEqual(first.keymap,patchAKey(before,5))
 assert.deepEqual(first.requestedKeymap,patchAKey(before,5))
 assert.equal(d.sent.at(-1)[2],2)
 assert.equal(d.sent.filter(t=>t[2]===7).length,5)
 // Reference 07 stays A while 08 still contains B until restoration.
 const restored=await client.setAKey(4)
 assert.equal(restored.verification,'readback-08')
 const writes=d.sent.filter(t=>t[2]===9)
 const official=JSON.parse(readFileSync(new URL('../docs/a80-keymap-01/transactions.json',import.meta.url))).transactions.filter(t=>t.command===9)
 assert.equal(writes.length,10)
 for(let i=0;i<10;i++)assert.deepEqual(writes[i],Uint8Array.from(official[i].requestHex.split(' ').slice(1).map(b=>parseInt(b,16))))
 const unknown=before.slice();unknown[266]=1;assert.throws(()=>encodeKeymapWrite(unknown),/槽位 88/)
 await assert.rejects(client.setAKey(6),/仅支持/)
 d.keymap[32]=6;await assert.rejects(client.setAKey(4),/不是已验证/)
 await client.close()
})
test('partial keymap write timeout never retries or reports success',async()=>{
 const partial=new KeyDevice(),c=clientFor(partial);partial.dropWrite=true
 await assert.rejects(c.setAKey(5),/应答超时/)
 assert.equal(partial.sent.filter(t=>t[2]===9).length,1)
 await assert.rejects(c.setAKey(4),/连接已失效/);await c.close()
})

test('08 backup preserves existing changes; 07 stays reference; snapshot reports current values',async()=>{
 const d=new KeyDevice(),c=clientFor(d)
 d.keymap[29]=26
 const before=d.keymap.slice();let backup
 const result=await c.setAKey(5,bytes=>{backup=bytes;assert.equal(d.sent.filter(r=>r[2]===9).length,0)})
 assert.deepEqual(backup,before)
 assert.equal(result.keymap[29],26);assert.equal(result.keymap[32],5)
 const snapshot=await c.readSnapshot()
 assert.equal(snapshot.keymap[32],4);assert.equal(snapshot.currentKeymap[32],5)
 assert.equal(snapshot.currentKeymap[29],26)
 await c.close()
})

test('four real 08 readings round-trip through profiles without changing any byte',()=>{
 const evidence=JSON.parse(readFileSync(new URL('../evidence/readback-08-verified.json',import.meta.url)))
 assert.equal(evidence.readings.length,4)
 assert.deepEqual(evidence.readings.map(r=>r.bytes[32]),[4,5,5,4])
 for(const reading of evidence.readings){
  const raw=Uint8Array.from(reading.bytes),profile=profileFromCurrent(raw)
  assert.equal(raw[266],0);assert.equal(profile.keymap[266],0x87)
  assert.deepEqual(encodeKeymapWrite(Uint8Array.from(profile.keymap)),raw)
 }
 assert.deepEqual(evidence.readings[0].bytes,evidence.readings[3].bytes)
})

test('keymap 08 mismatch stops writes and retains the pre-write backup',async()=>{
 const d=new KeyDevice(),c=clientFor(d);d.damage=true
 let backup
 await assert.rejects(c.setAKey(5,b=>{backup=b}),/08.*不一致/)
 assert.equal(backup[32],4);assert.equal(backup[266],0)
 assert.equal(d.sent.filter(r=>r[2]===9).length,5)
 await assert.rejects(c.setAKey(4),/连接已失效/)
 assert.equal(d.sent.filter(r=>r[2]===9).length,5)
 await c.close()
})
test('Q/Z/right profile writes reproduce all six official changes and restorations',async()=>{
 const official=JSON.parse(readFileSync(new URL('../docs/a80-keymap-calibration-02/transactions.json',import.meta.url))).transactions.filter(t=>t.command===9)
 for(const [index,slot,usage] of [[0,9,26],[1,9,20],[2,18,27],[3,18,29],[4,69,80],[5,69,79]]){
  const d=new KeyDevice(),c=clientFor(d),p=makeProfile();p.keymap[slot*3+2]=usage
  assert.equal((await c.setProfile(p)).verification,'readback-08')
  const writes=d.sent.filter(t=>t[2]===9)
  for(let i=0;i<5;i++)assert.deepEqual(writes[i],Uint8Array.from(official[index*5+i].requestHex.split(' ').slice(1).map(b=>parseInt(b,16))))
  await c.close()
 }
 const d=new KeyDevice(),c=clientFor(d),p=makeProfile('组合',5);p.keymap[29]=26;p.keymap[56]=27;p.keymap[209]=80
 assert.deepEqual((await c.setProfile(p)).requestedKeymap,Uint8Array.from(p.keymap))
 d.reference[0]=0;await assert.rejects(c.setProfile(p),/参考表/);await c.close()
})
test('modifier, function, navigation and mute reproduce all nine captured writes',async()=>{
 const official=JSON.parse(readFileSync(new URL('../docs/a80-keymap-types-03/transactions.json',import.meta.url))).transactions.filter(t=>t.command===9)
 const cases=[['ControlLeft',0x200400],['ControlLeft',0x200100],['F1',0x20003b],['F1',0x20003a],['Home',0x20004d],['Home',0x20004a],['F1',0x20003a],['F1',0x30e200],['F1',0x20003a]]
 for(let n=0;n<cases.length;n++){
  const [code,value]=cases[n],d=new KeyDevice(),c=clientFor(d),p=setProfileAssignment(makeProfile(),code,value)
  assert.equal((await c.setProfile(p)).verification,'readback-08')
  const writes=d.sent.filter(t=>t[2]===9)
  for(let i=0;i<5;i++)assert.deepEqual(writes[i],Uint8Array.from(official[n*5+i].requestHex.split(' ').slice(1).map(b=>parseInt(b,16))))
  await c.close()
 }
})

test('each preset reproduces its real captured write, including ripple 01; custom requires explicit settings',async()=>{
 const captured=JSON.parse(readFileSync(new URL('../docs/a80-effects-02/transactions.json',import.meta.url))).transactions
 assert.equal(lightingName(1),'波纹');assert.equal(lightingName(3),'呼吸')
 for(let mode=1;mode<=7;mode++){
  const d=new Device(),client=clientFor(d);d.config[1]=8
  const result=await client.setLighting(mode)
  const fixture=captured.find(t=>t.command===6&&parseInt(t.requestHex.split(' ')[9],16)===mode)
  assert.deepEqual(d.sent.find(t=>t[2]===6),Uint8Array.from(fixture.requestHex.split(' ').slice(1).map(b=>parseInt(b,16))))
  assert.equal(result.config[1],mode);await client.close()
 }
 const d=new Device(),client=clientFor(d);d.config[1]=8
 assert.equal((await client.readSnapshot()).config[1],8)
 await assert.rejects(client.setLighting(8),/自定义需要明确/)
 assert.ok(d.sent.every(t=>t[2]!==6));await client.close()
})

test('matches only the observed vendor collection and report sizes',()=>{
 const d=new Device();assert.equal(isCompatibleDevice(d),true)
 d.collections[0].inputReports[0].items[0].reportCount=64;assert.equal(isCompatibleDevice(d),false)
 d.vendorId=1;assert.equal(isCompatibleDevice(d),false)
})
test('assembles snapshot, ignoring unrelated and truncated reports',async()=>{
 const d=new Device(),client=clientFor(d),s=await client.readSnapshot()
 assert.equal(s.keymap.length,273);assert.equal(s.indices.length,91)
 assert.equal(s.keymap[272],16);assert.equal(s.indices[90],90)
 assert.deepEqual(s.config,observedConfig);assert.equal(s.currentKeymap.length,273);assert.equal(d.sent.length,23)
 await client.close()
})
test('lighting write preserves fields, adjusts write-only byte, and verifies readback',async()=>{
 const d=new Device(),client=clientFor(d)
 const result=await client.setLighting(3)
 assert.equal(result.changed,true);assert.equal(result.config[1],3)
 const write=d.sent.find(r=>r[2]===6);assert.ok(write);assert.equal(write[23],0)
 assert.deepEqual(d.sent.map(r=>r[2]),[5,5,1,6,2,5,5])
 const expected=observedConfig.slice();expected[1]=3;assert.deepEqual(result.config,expected)
 const before=d.sent.length;assert.equal((await client.setLighting(3)).changed,false)
 assert.equal(d.sent.length-before,2);await client.close()
})
test('unfamiliar config and unsupported modes cannot produce a write',async()=>{
 const d=new Device(),client=clientFor(d);d.config[2]=5
 await assert.rejects(client.setLighting(3),/配置与已验证样本不同/)
 await assert.rejects(client.setLighting(9),/仅支持/)
 assert.ok(d.sent.every(r=>r[2]!==6));await client.close()
})
test('timeout poisons connection without retrying; rejects overlapping operation',async()=>{
 const d=new Device(),client=clientFor(d);d.silent=true
 const pending=client.readSnapshot()
 await assert.rejects(client.readSnapshot(),/正在与键盘通信/)
 await assert.rejects(pending,/应答超时/)
 await assert.rejects(client.setLighting(3),/连接已失效/)
 assert.equal(d.sent.length,1);await client.close()
})
test('readback mismatch reports unknown result and prevents further writes',async()=>{
 const d=new Device(),client=clientFor(d);d.corrupt=true
 await assert.rejects(client.setLighting(3),/读回不一致/)
 await assert.rejects(client.setLighting(3),/连接已失效/)
 assert.equal(d.sent.filter(r=>r[2]===6).length,1);await client.close()
})
test('disconnect rejects outstanding request promptly',async()=>{
 const d=new Device(),client=clientFor(d);d.silent=true
 const pending=client.readSnapshot();const rejected=assert.rejects(pending,/设备已断开/)
 await client.close();await rejected;assert.equal(d.opened,false);assert.equal(d.sent.length,0)
})
