export function systemModeName(value){
 if(value===0)return 'Windows'
 if(value===1)return 'Mac'
 return Number.isInteger(value)?`未知模式（${value.toString(16).padStart(2,'0').toUpperCase()}）`:'未读取'
}
export function systemModeKeyNote(mode,code,assignment){
 if(code==='Fn')return 'Fn 使用固件固定功能，暂不支持编辑。'
 const overrides={MetaLeft:['左 Win','左 Alt'],AltLeft:['左 Alt','左 Win'],AltRight:['右 Alt','右 Win'],ControlRight:['右 Ctrl','右 Alt']}
 const keys=overrides[code]
 if(mode!==1||!keys)return ''
 if(!Number.isInteger(assignment))return 'Mac 模式会覆盖此实体位置的普通键映射；当前保存值尚未读取。'
 if((assignment>>>16)!==0x20)return '此键保存的是非普通键动作；Mac 模式下的实际输出尚未验证。'
 return `Mac 模式：实体${keys[0]}输出${keys[1]}（Windows 系统），覆盖此处保存的普通映射。切回键盘 Windows 模式后使用保存的映射。`
}
