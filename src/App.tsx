import { usePageRoute } from './use-page-route'
import { decodeLightingSettings } from './lighting-settings.mjs'

import { useEffect, useRef, useState } from 'react'
import { Keyboard, Sun, Layers, Activity, Terminal, Settings, Download, Upload, RotateCcw, Search, Check, Waves, Sparkles, Circle, Wind, Zap, Flower2, ChevronRight } from 'lucide-react'
import { Button } from './components/ui/button'
import { allKeys } from './keyboard'
import { KeyboardPreview } from './components/KeyboardPreview'
import { KeyLegend } from './components/KeyLegend'
import { LightingControls } from './components/LightingControls'
import { defaultPreviewSettings, type LightingPreviewSettings } from './lighting-preview'
import { actionTargetInfo } from './action-targets.mjs'
import { candidateKeys, experimentalTargets, readAssignment, assignmentLabel, unassignedTarget } from './keymap.mjs'
import { lightingModes, lightingName } from './lighting.mjs'
import { systemModeName, systemModeKeyNote } from './system-mode.mjs'
import { download, useKeyboard } from './use-keyboard'
import './App.css'

const navigation = [{ id: 'keymap', label: '键盘键位', icon: Keyboard }, { id: 'lighting', label: '按键背光', icon: Sun }, { id: 'fn', label: 'Fn 组合键', icon: Layers }, { id: 'tester', label: '键盘测试', icon: Activity }, { id: 'logs', label: '通信记录', icon: Terminal }]
const categories = ['基本', '媒体', '系统', '灯光']
const symbolUsages = new Set([45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56])
const effects = [Waves, Sparkles, Wind, Zap, Circle, Sun, Flower2, Settings]
const fnActions = [['F5','我的电脑'], ['F6','浏览器'], ['F7','Ctrl+Alt+Del'], ['F8','计算器'], ['F10','静音'], ['F11','音量 −'], ['F12','音量 +'], ['PrtSc','Insert'], ['Enter','播放 / 暂停'], ['←','上一首'], ['→','下一首'], ['Del','背光开关'], ['PgUp','亮度 +'], ['PgDn','亮度 −'], ['Home','灯效切换'], ['End','颜色切换'], ['1','蓝牙 · 需先切无线'], ['4','2.4G · 需先切无线']]
export default function App() {
  const device = useKeyboard()
  const page = usePageRoute()
  const [selected, setSelected] = useState('KeyA')
  const [category, setCategory] = useState('基本')
  const [search, setSearch] = useState('')
  const [chosenEffect, setEffect] = useState<number | null>(null)
  const effect = chosenEffect ?? device.snapshot?.config[1] ?? 2
  const [lightingPreviews, setLightingPreviews] = useState<{ source: string; values: Record<number, LightingPreviewSettings> }>({ source: '', values: {} })
  const lightingSource = device.connected ? device.snapshot?.readAt ?? '' : ''
  const previewSettings = (lightingPreviews.source === lightingSource ? lightingPreviews.values[effect] : undefined) ?? (device.snapshot ? decodeLightingSettings(device.snapshot.config) as LightingPreviewSettings : { ...defaultPreviewSettings(), brightness: 100 })
  const [tested, setTested] = useState<Set<string>>(new Set())
  const [pressed, setPressed] = useState<Set<string>>(new Set())
  const [lastKey, setLastKey] = useState('点击此面板后，按下键盘上的按键')
  const file = useRef<HTMLInputElement>(null)
  const selectedKey = candidateKeys.find(key => key.code === selected)
  const assignment = selectedKey && device.draft ? readAssignment(device.draft.keymap, selectedKey.slot) : undefined
  const current = selectedKey && device.snapshot ? readAssignment(device.snapshot.currentKeymap, selectedKey.slot) : undefined
  useEffect(() => {
    if (page !== 'tester') return
    const down = (e: KeyboardEvent) => { if ((e.target as HTMLElement).closest('input,textarea,button')) return; e.preventDefault(); setPressed(p => new Set(p).add(e.code)); setTested(p => new Set(p).add(e.code)); setLastKey(`${e.code} · ${e.key} ${e.ctrlKey ? 'Ctrl' : ''} ${e.altKey ? 'Alt' : ''} ${e.metaKey ? 'Win / Cmd' : ''}`) }
    const up = (e: KeyboardEvent) => setPressed(p => { const next = new Set(p); next.delete(e.code); return next })
    const blur = () => setPressed(new Set())
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) }
  }, [page])
  function keyName(code: string, fallback: string) {
    const key = candidateKeys.find(k => k.code === code)
    return device.draft && key ? assignmentLabel(readAssignment(device.draft.keymap, key.slot)) : fallback || 'Space'
  }
  const groups = ['媒体', '系统', '灯光'].includes(category) ? [{ title: category, targets: experimentalTargets.filter(t => actionTargetInfo(t.assignment)?.category === category) }] : [
    { title: '字母键', targets: experimentalTargets.filter(t => (t.assignment & 0xffff) >= 4 && (t.assignment & 0xffff) <= 29).sort((a, b) => a.assignment - b.assignment) },
    { title: '数字键', targets: experimentalTargets.filter(t => (t.assignment & 0xffff) >= 30 && (t.assignment & 0xffff) <= 39) },
    { title: '符号键', targets: experimentalTargets.filter(t => t.assignment >>> 16 === 0x20 && symbolUsages.has(t.assignment & 0xffff)) },
    { title: '功能键', targets: [unassignedTarget, ...experimentalTargets.filter(t => t.assignment >>> 16 === 0x20 && (t.assignment & 0xffff) >= 40 && !symbolUsages.has(t.assignment & 0xffff))] },
  ]
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#/keymap" aria-label="ShiQunix 首页">shiQunix</a>
      <button className="device-card" onClick={device.connect} disabled={device.busy || device.connected} title={device.connected ? "键盘已连接" : "连接键盘"}><span className="device-icon"><Keyboard size={23}/></span><span><strong>IQUNIX A80</strong><small className={device.connected ? 'online' : ''}>{device.busy ? '通信中…' : device.connected ? `已连接 · ${device.snapshot ? systemModeName(device.snapshot.osMode) : 'USB'}` : '点击连接键盘'}</small></span>{!device.connected && <ChevronRight size={14}/>}</button>
      {device.connected && <button className="disconnect-device" disabled={device.busy} onClick={device.disconnect}>断开连接</button>}
      <nav>{navigation.map(item => <a key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} href={`#/${item.id}`} aria-current={page === item.id ? 'page' : undefined}><item.icon size={17}/>{item.label}</a>)}</nav>
      <div className="sidebar-bottom"><span className="local-badge"><span/> 本地 WebHID 驱动</span><p>A80 / WIRELESS RGB</p><small>ShiQunix · Preview</small></div>
    </aside>
    <main>
      <section className="preview-area">
        <div className="board-column">
          <KeyboardPreview systemMode={systemModeName(device.snapshot?.osMode)} page={page} effect={effect} selected={selected} tested={tested} pressed={pressed} onSelect={setSelected} keyName={keyName} previewSettings={previewSettings}/>
        </div>
        {page === 'keymap' && <aside className="inspector"><div><small>当前选择</small><h2>{allKeys.find(k => k.code === selected)?.label || 'Space'}</h2><p>{current === undefined ? '' : `设备：${assignmentLabel(current)}`}</p>{assignment !== undefined && assignment !== current && <p>草稿：{assignmentLabel(assignment)}</p>}</div><Button variant="secondary" disabled={!device.draft || device.busy} onClick={() => download('shiqunix-profile.json', device.draft)}><Download/>导出配置</Button><Button variant="secondary" disabled={device.busy} onClick={() => file.current?.click()}><Upload/>导入配置</Button><input ref={file} hidden type="file" accept=".json" onChange={e => { if (e.target.files?.[0]) void device.importFile(e.target.files[0]); e.target.value = '' }}/><Button variant="ghost" disabled={!device.connected || device.busy} onClick={device.refresh}><RotateCcw/>重新读取{device.dirty ? '并撤销草稿' : ''}</Button></aside>}
      </section>
      {(device.error || device.connected || device.dirty) && <div className={`notice ${device.error ? 'error' : ''}`} role="status">{device.error || device.message}</div>}
      <section className="workspace-panel">
        {page === 'keymap' && <><div className="panel-toolbar"><div className="pill-tabs">{categories.map(c => <button key={c} className={category === c ? 'selected' : ''} onClick={() => setCategory(c)}>{c}</button>)}</div><label className="search"><Search size={16}/><input placeholder="搜索键位" value={search} onChange={e => setSearch(e.target.value)}/></label><Button variant="secondary" title="将全部键位恢复为默认映射草稿，应用后生效" disabled={!device.connected || !device.snapshot || !device.draft || device.busy} onClick={device.resetKeymap}><RotateCcw/>重置键位</Button><Button disabled={!device.connected || !device.snapshot || !device.dirty || device.busy} onClick={device.apply}><Check/>应用修改{device.dirty ? ' · 待保存' : ''}</Button></div><p className="mode-note">{systemModeKeyNote(device.snapshot?.osMode, selected, assignment) || '选择上方实体按键，再从下方指定功能。修改仅在点击应用后生效。'}</p><p className="candidate-note">{assignment !== undefined && actionTargetInfo(assignment) ? actionTargetInfo(assignment)?.note : null}</p><div className="library">{groups.map(group => <section className="key-group" key={group.title}><h3>{group.title}</h3><div className="target-grid">{group.targets.filter(t => (t.label + ' ' + (actionTargetInfo(t.assignment)?.note ?? '')).toLowerCase().includes(search.toLowerCase())).map((target, i) => <button key={`${target.assignment}-${i}`} title={actionTargetInfo(target.assignment)?.note} className={assignment === target.assignment ? 'chosen' : ''} disabled={!device.draft || !selectedKey || device.busy} onClick={() => device.assign(selected, target.assignment)}><KeyLegend label={target.label}/></button>)}</div></section>)}</div></>}
        {page === 'lighting' && <><div className="panel-toolbar"><div className="pill-tabs"><button className="selected">灯效选择</button></div><span className="subtle">当前：{device.snapshot ? lightingName(device.snapshot.config[1]) : '未读取'}</span><Button disabled={!device.connected || !device.snapshot || device.busy} onClick={() => device.lighting(effect, previewSettings)}>应用灯效</Button></div><div className="lighting-layout"><div className="effects-panel"><h3>灯效</h3><div className="effect-grid">{lightingModes.map((mode, i) => { const Icon = effects[i]; return <button key={mode.value} className={effect === Number(mode.value) ? 'chosen' : ''} onClick={() => setEffect(Number(mode.value))}><Icon size={23}/><span>{mode.name}</span>{!mode.writable && <small>仅预览</small>}</button> })}</div></div><aside className="effect-settings"><h3>设置</h3><LightingControls effect={effect} settings={previewSettings} onChange={next => setLightingPreviews(previous => ({ source: lightingSource, values: { ...(previous.source === lightingSource ? previous.values : {}), [effect]: next } }))}/></aside></div></>}
        {page === 'fn' && <><h2>Fn 组合键</h2><p className="mode-note">以下为 Windows 模式下已确认的功能；由固件处理，暂不支持编辑。切换 Mac 模式后可能不同。</p><div className="fn-grid">{fnActions.map(([key, label]) => <div key={key}><kbd>Fn + {key}</kbd><span>{label}</span></div>)}</div></>}
        {page === 'tester' && <div className="tester" tabIndex={0}><Activity size={32}/><h2>{lastKey}</h2><p>已检测 {tested.size} 个按键。系统保留快捷键可能无法传到网页。</p><Button variant="secondary" onClick={() => { setTested(new Set()); setPressed(new Set()); setLastKey('测试记录已清空') }}>清空测试</Button></div>}
        {page === 'logs' && <><div className="panel-toolbar"><h2>通信记录 <small>最近 {device.logs.length} 条</small></h2><Button variant="secondary" onClick={() => download('shiqunix-a80-log.json', device.logs)}>导出记录</Button><Button variant="secondary" disabled={!device.snapshot} onClick={() => download('shiqunix-snapshot.json', device.snapshot)}>设备快照</Button><Button variant="secondary" disabled={!device.backup} onClick={() => download('shiqunix-backup.json', { format: 'shiqunix-08-backup', keymap: device.backup })}>写前备份</Button></div><div className="log-list">{device.logs.length ? device.logs.map((log, i) => <div key={i}><time>{log.time.slice(11, 23)}</time><b>{log.direction}</b><code>{log.data.map(b => b.toString(16).padStart(2, '0')).join(' ')}</code></div>) : <p>连接键盘后，通信记录会显示在这里。</p>}</div></>}
      </section>
    </main>
  </div>
}


