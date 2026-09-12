// Names follow the user's ordered eight-effect experiment, usb-effects-02.
export const lightingModes = [
 {value:'1',name:'波纹',desc:'彩色波纹向右移动',class:'ripple',writable:true},
 {value:'2',name:'光谱',desc:'全键同步进行颜色过渡',class:'spectrum',writable:true},
 {value:'3',name:'呼吸',desc:'暗 → 亮 → 暗，在暗下后切换颜色',class:'spectrum',writable:true},
 {value:'4',name:'按键反应',desc:'按下的单个键亮起，再逐渐熄灭',class:'ripple',writable:true},
 {value:'5',name:'涟漪',desc:'从触发键向外扩散，每次触发使用一种颜色',class:'ripple',writable:true},
 {value:'6',name:'常亮',desc:'全彩或指定单色持续点亮',class:'spectrum',writable:true},
 {value:'7',name:'百花齐放',desc:'全彩常亮，各按键分别变化颜色',class:'spectrum',writable:true},
 {value:'8',name:'自定义',desc:'指定单色全亮或全灭',class:'custom',writable:true},
]
export const isWritableMode = mode => lightingModes.some(effect=>Number(effect.value)===mode&&effect.writable)
export const lightingName = mode => lightingModes.find(effect=>Number(effect.value)===mode)?.name??`未知模式 (${mode})`
