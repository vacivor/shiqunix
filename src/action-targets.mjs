// Exact three-byte actions from the original A80 Fn table. These are ordinary
// mapping targets, not writes to the fixed Fn table or guessed VIA keycodes.
export const actionTargets = [
  {assignment:0x30e200,label:'Mute',category:'媒体',note:'Toggle mute'},
  {assignment:0x30ea00,label:'Vol −',category:'媒体',note:'Volume down'},
  {assignment:0x30e900,label:'Vol +',category:'媒体',note:'Volume up'},
  {assignment:0x30cd00,label:'Play / Pause',category:'媒体',note:'Play or pause'},
  {assignment:0x30b600,label:'Previous',category:'媒体',note:'Previous track'},
  {assignment:0x30b500,label:'Next',category:'媒体',note:'Next track'},
  {assignment:0x309201,label:'Calc',category:'系统',note:'Open calculator'},
  {assignment:0x309401,label:'My Comp',category:'系统',note:'Open My Computer'},
  {assignment:0x302302,label:'WWW Home',category:'系统',note:'Open browser home page'},
  {assignment:0xa0ac00,label:'Ctrl+Alt+Del',category:'系统',note:'Ctrl + Alt + Delete'},
  {assignment:0xa00300,label:'Lock Win',category:'系统',note:'Lock Windows key'},
  {assignment:0xa0ad00,label:'Light On / Off',category:'灯光',note:'Toggle backlight'},
  {assignment:0xa01200,label:'Bright +',category:'灯光',note:'Increase brightness'},
  {assignment:0xa01300,label:'Bright −',category:'灯光',note:'Decrease brightness'},
  {assignment:0xa01400,label:'Speed +',category:'灯光',note:'Increase effect speed'},
  {assignment:0xa01500,label:'Speed −',category:'灯光',note:'Decrease effect speed'},
  {assignment:0xa01000,label:'Effect Cycle',category:'灯光',note:'Next lighting effect'},
  {assignment:0xa01600,label:'Color Cycle',category:'灯光',note:'Next backlight color'},
].map(target=>({...target,physicalVerified:['媒体','灯光'].includes(target.category)}))

export const actionTargetInfo = assignment => actionTargets.find(target=>target.assignment===assignment)
