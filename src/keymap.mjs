import candidates from './data/layout-candidates.json' with {type:'json'}
import {actionTargets} from './action-targets.mjs'
export const KEYMAP_LENGTH=273
export const KEYMAP_FRAGMENTS=[[0,56],[56,56],[112,56],[168,56],[224,49]]
export const VERIFIED_A_SLOT=10
export const unassignedTarget={assignment:0x200000,label:'未分配'}
export const mappedKeys=[
 {code:'KeyA',label:'A',slot:10,options:[{usage:4,label:'A'},{usage:5,label:'B'}],physicalVerified:true},
 {code:'KeyQ',label:'Q',slot:9,options:[{usage:20,label:'Q'},{usage:26,label:'W'}],physicalVerified:true},
 {code:'KeyZ',label:'Z',slot:18,options:[{usage:29,label:'Z'},{usage:27,label:'X'}],physicalVerified:true},
 {code:'ArrowRight',label:'→',slot:69,options:[{usage:79,label:'→'},{usage:80,label:'←'}],physicalVerified:true},
 {code:'ControlLeft',label:'L Ctrl',slot:5,options:[{usage:0x100,label:'L Ctrl'},{usage:0x400,label:'L Alt'}],physicalVerified:true},
 {code:'F1',label:'F1',slot:7,options:[{usage:58,label:'F1'},{usage:59,label:'F2'},{assignment:0x30e200,label:'Mute'}],physicalVerified:true},
 {code:'Home',label:'Home',slot:62,options:[{usage:74,label:'Home'},{usage:77,label:'End'}],physicalVerified:true},
]
export const optionAssignment=option=>option.assignment??(0x200000|option.usage)
export const readAssignment=(bytes,slot)=>(bytes[slot*3]<<16)|(bytes[slot*3+1]<<8)|bytes[slot*3+2]
export const experimentalTargets=candidates.filter(k=>k.assignment!==null).map(k=>({assignment:k.assignment,label:k.code.startsWith('Control')?(k.code.endsWith('Left')?'L Ctrl':'R Ctrl'):k.code.startsWith('Shift')?(k.code.endsWith('Left')?'L Shift':'R Shift'):k.code.startsWith('Alt')?(k.code.endsWith('Left')?'L Alt':'R Alt'):k.code.startsWith('Meta')?(k.code.endsWith('Left')?'L Win':'R Win'):k.label})).concat(actionTargets,unassignedTarget)
export const candidateKeys=candidates.filter(k=>k.slot!==null).map(k=>({code:k.code,label:k.label,slot:k.slot,physicalVerified:mappedKeys.some(v=>v.code===k.code),options:experimentalTargets}))
export const editableKeys=experimental=>experimental?candidateKeys:mappedKeys
export const assignmentLabel=assignment=>experimentalTargets.find(o=>o.assignment===assignment)?.label??`0x${assignment.toString(16).toUpperCase()}`
export function patchAKey(before,usage){
 if(!(before instanceof Uint8Array)||before.length!==KEYMAP_LENGTH)throw new Error('键位表长度不匹配。')
 if(![4,5].includes(usage))throw new Error('当前实验仅支持实体 A 键映射为 A 或 B。')
 const offset=VERIFIED_A_SLOT*3
 if(before[offset]!==0x20||before[offset+1]!==0||![4,5].includes(before[offset+2]))throw new Error('A 槽位当前不是已验证的 A/B 映射，暂不写入。')
 const after=before.slice();after[offset+2]=usage
 return after
}
export function encodeKeymapWrite(desired){
 if(!(desired instanceof Uint8Array)||desired.length!==KEYMAP_LENGTH)throw new Error('键位表长度不匹配。')
 // Both successful official writes encode slot 88 as 200000. A later device
 // read still returned 200087. This is an observed encoding, not a key mapping.
 if(desired[264]!==0x20||desired[265]!==0||![0,0x87].includes(desired[266]))throw new Error('槽位 88 超出已验证的读写表示，暂不写入。')
 const wire=desired.slice();wire[266]=0;return wire
}
