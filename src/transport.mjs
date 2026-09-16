import {applyLightingSettings,customLightingBlock} from './lighting-settings.mjs'
import {lightingModes,isWritableMode} from './lighting.mjs'
import {KEYMAP_FRAGMENTS,patchAKey,encodeKeymapWrite} from './keymap.mjs'
import {validateProfile,referenceBytes} from './profiles.mjs'
import {assertUniqueMacMappings} from './mac-mapping.mjs'
import {buildRequest,inspectResponse,assembleFragments,REPORT_ID} from './protocol.mjs'
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const READ_COMMANDS=new Set([3,5,7,8,0x1b])
export const observedConfig=Uint8Array.from([0,2,4,2,0,1,255,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0])
export function canWriteLighting(config){
 return config instanceof Uint8Array&&config.length===26&&lightingModes.some(effect=>Number(effect.value)===config[1])&&config[2]<=4&&config[3]<=4&&[0,1,255].includes(config[5])&&[0,8].includes(config[9])&&config.every((b,i)=>[1,2,3,5,6,7,8,9].includes(i)||b===observedConfig[i])
}
function collectionsOf(collections){return collections.flatMap(c=>[c,...collectionsOf(c.children??[])])}
export function isCompatibleDevice(device){
 if(device.vendorId!==0x05ac||device.productId!==0x024f)return false
 return collectionsOf(device.collections??[]).some(c=>c.usagePage===0xff1c&&
  ['inputReports','outputReports'].every(kind=>(c[kind]??[]).some(r=>r.reportId===4&&r.items?.reduce((n,i)=>n+i.reportSize*i.reportCount,0)===504)))
}
export async function chooseDevice(){
 if(!globalThis.navigator?.hid)throw new Error('请在桌面 Chrome 或 Edge 中打开此页面。当前浏览器不支持 WebHID。')
 const devices=await navigator.hid.requestDevice({filters:[{vendorId:0x05ac,productId:0x024f,usagePage:0xff1c}]})
 if(!devices.length)return null
 const device=devices.find(isCompatibleDevice)
 if(!device)throw new Error('所选设备的接口或报告长度与已验证的 A80 不一致。')
 if(!device.opened)await device.open()
 return device
}
export class A80Client {
 /** @param {any} device @param {{onLog?: (entry:any)=>void, timeout?:number, gap?:number}} options */
 constructor(device,{onLog=()=>{},timeout=1200,gap=35}={}){
  this.device=device;this.onLog=onLog;this.timeout=timeout;this.gap=gap;this.pending=null;this.busy=false;this.faulted=false;this.closed=false
  this.onInput=e=>{
   if(e.reportId!==REPORT_ID)return
   const data=new Uint8Array(e.data.buffer,e.data.byteOffset,e.data.byteLength).slice()
   this.log('IN',data)
   const pending=this.pending
   if(!pending||data.length!==63)return
   const result=inspectResponse(pending.request,e.reportId,data)
   if(!result.matched)return
   const command=pending.request[2]
   const accepted=READ_COMMANDS.has(command)?result.prefixMatchesRequestCrc:
    command===0xf0?data[7]===255&&data.every((b,i)=>i===7||b===pending.request[i]):result.exactEcho
   if(!accepted)return
   clearTimeout(pending.timer);this.pending=null;pending.resolve(result)
  }
  device.addEventListener('inputreport',this.onInput)
 }
 log(direction,data){this.onLog({time:new Date().toISOString(),direction,reportId:4,data:Array.from(data)})}
 fail(error){
  this.faulted=true
  if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(error);this.pending=null}
 }
 async close(){
  this.closed=true;this.fail(new Error('设备已断开，请重新连接。'));this.device.removeEventListener('inputreport',this.onInput)
  if(this.device.opened)await this.device.close()
 }
 async exclusive(action){
  if(this.busy)throw new Error('正在与键盘通信，请等待当前操作完成。')
  if(this.faulted||this.closed||!this.device.opened)throw new Error('连接已失效，请断开后重新连接键盘。')
  this.busy=true
  try{return await action()}finally{this.busy=false}
 }
 async request(options,{gap=this.gap}={}){
  if(this.faulted||this.closed)throw new Error('连接已失效，请重新连接。')
  if(this.pending)throw new Error('不能同时发送多个请求。')
  const request=buildRequest(options)
  const result=await new Promise((resolve,reject)=>{
   const entry={request,resolve,reject,timer:null}
   entry.timer=setTimeout(()=>{if(this.pending===entry)this.fail(new Error('键盘应答超时，结果未知。请关闭官方驱动并重新连接；不会自动重发。'))},this.timeout)
   this.pending=entry;this.log('OUT',request)
   Promise.resolve().then(()=>{if(this.pending===entry&&!this.closed)return this.device.sendReport(4,request)}).catch(error=>{if(this.pending===entry)this.fail(new Error(`发送失败：${error.message}`))})
  })
  if(gap>0)await pause(gap)
  return result
 }
 async readConfig(){
  await this.request({command:5,length:1})
  return (await this.request({command:5,length:26})).payload
 }
 async readOsModeBlock(){
  // Confirmed on hardware: Windows -> Mac -> Windows returns 00 -> 01 -> 00.
  const response=await this.request({command:5,length:1,offset:0x2c})
  return response.payload[0]
 }
 async readOsModeProbe(){return this.exclusive(()=>this.readOsModeBlock())}
 async readKeymap(){
  const fragments=[]
  for(const [offset,length] of KEYMAP_FRAGMENTS)fragments.push({offset,payload:(await this.request({command:7,length,offset})).payload})
  return assembleFragments(fragments,273)
 }
 async readCurrentKeymapBlock(){
  // Firmware-backed experimental read. Do not insert 07: its handler calls
  // a persistence helper before returning the fixed reference table.
  await this.request({command:1})
  const fragments=[]
  for(const [offset,length] of KEYMAP_FRAGMENTS)fragments.push({offset,payload:(await this.request({command:8,length,offset})).payload})
  await this.request({command:2})
  return assembleFragments(fragments,273)
 }
 async readCurrentKeymap(){return this.exclusive(()=>this.readCurrentKeymapBlock())}
 async setAKey(usage,onBackup=(_data)=>{}){
  if(![4,5].includes(usage))throw new Error('当前实验仅支持实体 A 键映射为 A 或 B。')
  return this.writeKeymap(before=>patchAKey(before,usage),onBackup)
 }
 async setProfile(profile,onBackup=(_data)=>{},options={}){
  const desired=Uint8Array.from(validateProfile(profile).keymap)
  assertUniqueMacMappings(desired)
  const checkMode=Object.hasOwn(options,'expectedOsMode')
  if(checkMode&&![0,1].includes(options.expectedOsMode))throw new Error('键盘模式未识别，请重新读取后再应用。')
  const reference=referenceBytes()
  return this.writeKeymap(async(_before,deviceReference)=>{
   if(!deviceReference.every((b,i)=>b===reference[i]))throw new Error('设备参考表与已校准布局不一致，暂不应用。')
   if(checkMode&&(await this.readOsModeBlock())!==options.expectedOsMode)throw new Error('键盘模式已变化，请重新读取后再编辑；尚未写入。')
   return desired
  },onBackup)
 }
 async writeKeymap(selectDesired,onBackup=(_data)=>{}){return this.exclusive(async()=>{
  await this.request({command:1})
  const reference=await this.readKeymap()
  await this.request({command:2})
  const before=await this.readCurrentKeymapBlock()
  const desired=await selectDesired(before,reference)
  const wire=encodeKeymapWrite(desired)
  onBackup(before.slice())
  // Preserve the captured write sequence; verify separately with 08, never 07.
  // Official writes send the next request immediately after each acknowledgement.
  // Only the last fragment has a measured ~11–17 ms pause before command 02.
  await this.request({command:3,length:34},{gap:0})
  await this.request({command:3,length:34},{gap:0})
  await this.request({command:1},{gap:0})
  for(const [offset,length] of KEYMAP_FRAGMENTS)await this.request({command:9,length,offset,payload:wire.slice(offset,offset+length),padding:length===49?wire.slice(217,224):new Uint8Array()},{gap:length===49?15:0})
  await this.request({command:2})
  const after=await this.readCurrentKeymapBlock()
  if(!after.every((b,i)=>b===wire[i])){
   this.faulted=true
   throw new Error('08 当前键位读回与目标不一致，结果未知；已停止写入。请导出写前备份和通信记录，重新连接后检查实际输入。')
  }
  return {requestedKeymap:desired,keymap:after,verification:'readback-08',backup:before}
 })}
 async readSnapshot(){return this.exclusive(async()=>{
  for(let i=0;i<3;i++)await this.request({command:0xf0})
  await this.request({command:1})
  const info=(await this.request({command:3,length:34})).payload
  const keys=[]
  for(const [offset,length] of [[0,56],[56,56],[112,56],[168,56],[224,49]])keys.push({offset,payload:(await this.request({command:7,length,offset})).payload})
  const indices=[]
  for(const [offset,length] of [[0,56],[56,35]])indices.push({offset,payload:(await this.request({command:0x1b,length,offset})).payload})
  await this.request({command:2})
  const currentKeymap=await this.readCurrentKeymapBlock()
  const config=await this.readConfig()
  const osMode=await this.readOsModeBlock(),osModeReadAt=new Date().toISOString()
  return {info,keymap:assembleFragments(keys,273),currentKeymap,indices:assembleFragments(indices,91),config,osMode,osModeReadAt,readAt:new Date().toISOString()}
 })}
 async setLighting(mode,settings){return this.exclusive(async()=>{
  if(!isWritableMode(mode))throw new Error('当前仅支持八种已识别灯效。')
  if(mode===8&&!settings)throw new Error('自定义需要明确指定颜色和全亮／全灭。')
  const before=await this.readConfig()
  if(!canWriteLighting(before))throw new Error(`当前配置与已验证样本不同，暂不写入。配置：${Array.from(before,b=>b.toString(16).padStart(2,'0')).join(' ')}。请导出通信记录。`)
  const payload=applyLightingSettings(before,mode,settings)
  const custom=mode===8?customLightingBlock(payload,settings.enabled):null
  if(!custom&&payload.every((b,i)=>i===16||b===before[i]))return {config:before,changed:false,verification:'config-readback'}
  await this.request({command:1})
  await this.request({command:6,length:26,payload})
  await this.request({command:2})
  const after=await this.readConfig()
  if(!after.every((b,i)=>b===(i===16?before[i]:payload[i]))){
   this.faulted=true;throw new Error('写入后的配置读回不一致，结果未知。请重新连接并检查键盘。')
  }
  if(custom){
   // Captured all-on/all-off actions send 0B directly, without 01/02 around it.
   for(const [offset,length] of KEYMAP_FRAGMENTS)await this.request({command:0x0b,length,offset,payload:custom.slice(offset,offset+length),padding:length===49?custom.slice(217,224):new Uint8Array()},{gap:0})
  }
  return {config:after,changed:true,verification:custom?'custom-echo-only':'config-readback'}
 })}
}
