import reference from './data/captured-keymap.json' with {type:'json'}
import {editableKeys,optionAssignment,readAssignment} from './keymap.mjs'
export const PROFILE_STORAGE_KEY='shiqunix.profiles.v1'
export const referenceBytes=()=>Uint8Array.from(reference.flatMap(s=>s.assignmentHex.match(/../g).map(b=>parseInt(b,16))))
export function makeProfile(name='A80 配置',usage=4){
 const keymap=Array.from(referenceBytes());keymap[32]=usage
 return validateProfile({format:'shiqunix-keymap',version:1,device:'05ac:024f',name,keymap})
}
export function profileFromCurrent(bytes,name='键盘当前配置'){
 if(!(bytes instanceof Uint8Array)||bytes.length!==273)throw new Error('当前键位表长度不匹配。')
 const keymap=Array.from(bytes)
 // Profile v1 stores the reference representation for reserved slot 88.
 // Accept the two known representations, as encodeKeymapWrite already does.
 // Normalize only the editable profile; snapshots and write backups stay raw.
 if(keymap[264]!==0x20||keymap[265]!==0||![0,0x87].includes(keymap[266])){
  const actual=keymap.slice(264,267).map(byte=>byte.toString(16).padStart(2,'0').toUpperCase()).join(' ')
  throw new Error(`当前表的保留槽位 88 为 ${actual}，尚未识别；请导出通信记录。`)
 }
 keymap[266]=0x87
 return validateProfile({...makeProfile(name),keymap,experimental:true})
}
export function validateProfile(value){
 if(!value||value.format!=='shiqunix-keymap'||value.version!==1||value.device!=='05ac:024f')throw new Error('不是兼容的 ShiQunix A80 配置文件。')
 if(typeof value.name!=='string'||!value.name.trim()||value.name.length>60)throw new Error('配置名称需要 1–60 个字符。')
 if(!Array.isArray(value.keymap)||value.keymap.length!==273||value.keymap.some(b=>!Number.isInteger(b)||b<0||b>255))throw new Error('配置必须包含 273 个有效字节。')
 const baseline=referenceBytes()
 if(value.experimental!==undefined&&typeof value.experimental!=='boolean')throw new Error('实验模式标记无效。')
 const mappedKeys=editableKeys(value.experimental===true)
 if(value.keymap.some((b,i)=>!mappedKeys.some(k=>k.slot===Math.floor(i/3))&&b!==baseline[i])||mappedKeys.some(key=>!key.options.some(o=>optionAssignment(o)===readAssignment(value.keymap,key.slot))))throw new Error('配置包含尚未开放的键位或目标编码。')
 return {format:'shiqunix-keymap',version:1,device:'05ac:024f',name:value.name.trim(),keymap:[...value.keymap],experimental:value.experimental===true}
}
export function setProfileAssignment(profile,code,assignment){
 const next=validateProfile(profile),key=editableKeys(next.experimental).find(k=>k.code===code)
 if(!key||!key.options.some(o=>optionAssignment(o)===assignment))throw new Error('尚未开放此按键或映射目标。')
 next.keymap.splice(key.slot*3,3,assignment>>>16,(assignment>>>8)&255,assignment&255)
 return validateProfile(next)
}
export function resetProfileAssignments(profile){
 const current=validateProfile(profile)
 return validateProfile({...current,keymap:Array.from(referenceBytes())})
}
export function parseProfile(text){
 if(typeof text!=='string'||text.length>32768)throw new Error('配置文件过大。')
 return validateProfile(JSON.parse(text))
}
export function parseSavedProfiles(text){
 const values=JSON.parse(text)
 if(!Array.isArray(values)||values.length<1||values.length>30)throw new Error('本地配置列表损坏。')
 const profiles=values.map(validateProfile)
 if(new Set(profiles.map(p=>p.name)).size!==profiles.length)throw new Error('本地配置名称重复。')
 return profiles
}
