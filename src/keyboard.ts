export type Key = { label:string; code:string; usage:number; width:number; gap?:number }
const k=(label:string,code:string,usage:number,width=1,gap=0):Key=>({label,code,usage,width,gap})
export const rows:Key[][] = [
 [k('Esc','Escape',41,1,.0),...Array.from({length:12},(_,i)=>k(`F${i+1}`,`F${i+1}`,58+i,1,i===0?1:0)),k('PrtSc','PrintScreen',70),k('Del','Delete',76)],
 [k('~','Backquote',53),...Array.from({length:10},(_,i)=>k(String((i+1)%10),`Digit${(i+1)%10}`,i===9?39:30+i)),k('−','Minus',45),k('=','Equal',46),k('Backspace','Backspace',42,2),k('PgUp','PageUp',75)],
 [k('Tab','Tab',43,1.5),...'QWERTYUIOP'.split('').map(c=>k(c,`Key${c}`,c.charCodeAt(0)-61)),k('[','BracketLeft',47),k(']','BracketRight',48),k('\\','Backslash',49,1.5),k('PgDn','PageDown',78)],
 [k('Caps','CapsLock',57,1.75),...'ASDFGHJKL'.split('').map(c=>k(c,`Key${c}`,c.charCodeAt(0)-61)),k(';','Semicolon',51),k("'",'Quote',52),k('Enter','Enter',40,2.25),k('Home','Home',74)],
 [k('Shift','ShiftLeft',0x200,2.25),...'ZXCVBNM'.split('').map(c=>k(c,`Key${c}`,c.charCodeAt(0)-61)),k(',','Comma',54),k('.','Period',55),k('/','Slash',56),k('Shift','ShiftRight',0x2000,1.75),k('↑','ArrowUp',82),k('End','End',77)],
 [k('Ctrl','ControlLeft',0x100,1.25),k('Win','MetaLeft',0x800,1.25),k('Alt','AltLeft',0x400,1.25),k('','Space',44,6.25),k('Alt','AltRight',0x4000),k('Fn','Fn',-1),k('Ctrl','ControlRight',0x1000),k('←','ArrowLeft',80),k('↓','ArrowDown',81),k('→','ArrowRight',79)]
]
export const allKeys=rows.flat()
export const keyLabel=(assignment:string)=> {
 const n=parseInt(assignment,16)
 if(n===0x30e200)return '静音'
 if(n===0 || n===0x200000)return '未分配'
 if((n&0xff0000)===0x200000){const key=allKeys.find(k=>k.usage===(n&0xffff));return key?.label || (n===0x20002c?'Space':`0x${(n&0xffff).toString(16).toUpperCase()}`)}
 return assignment
}

