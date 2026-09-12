// Configuration offsets and custom block shape from usb-light-parameters-02.
export function decodeLightingSettings(config) {
 return {brightness:config[2]*25,speed:(4-config[3])*25,colorMode:config[5]===1?'rainbow':'single',
  color:'#'+Array.from(config.slice(6,9),v=>v.toString(16).padStart(2,'0')).join(''),enabled:true}
}
export function applyLightingSettings(before,mode,settings) {
 const payload=before.slice();payload[1]=mode;payload[16]=0
 if(!settings)return payload
 for(const value of [settings.brightness,settings.speed])if(!Number.isInteger(value)||value<0||value>100||value%25)throw new Error('亮度和速度必须使用五档设置。')
 if(!['rainbow','single'].includes(settings.colorMode)||!/^#[\da-f]{6}$/i.test(settings.color)||typeof settings.enabled!=='boolean')throw new Error('灯效颜色或开关设置无效。')
 payload[2]=settings.brightness/25
 if(![6,8].includes(mode))payload[3]=4-settings.speed/25
 // Preserve the user-observed FF color flag unless color was explicitly edited.
 if([1,4,5,6,8].includes(mode)&&(mode===8||before[5]!==255||settings.colorChanged)) {
  payload[5]=mode===8||settings.colorMode==='single'?0:1
  if(payload[5]===0)payload.set(settings.color.slice(1).match(/../g).map(v=>parseInt(v,16)),6)
 }
 return payload
}
export function customLightingBlock(payload,enabled) {
 const block=new Uint8Array(273)
 // The five empty positions are LED-table positions, not ordinary keymap slots.
 const empty=new Set([6,20,68,83,90])
 const rgb=payload.slice(6,9).map(v=>Math.max(0,v-1))
 if(enabled)for(let slot=0;slot<91;slot++)if(!empty.has(slot))block.set(rgb,slot*3)
 return block
}
