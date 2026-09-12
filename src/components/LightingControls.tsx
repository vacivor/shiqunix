import { colorSelectable, type LightingPreviewSettings } from '../lighting-preview'

export function LightingControls({ effect, settings, onChange }: { effect: number; settings: LightingPreviewSettings; onChange: (next: LightingPreviewSettings) => void }) {
  const patch = (value: Partial<LightingPreviewSettings>) => onChange({ ...settings, ...value })
  return <div className="lighting-controls">
    <label>亮度 <output>{settings.brightness}%</output><input aria-label="亮度" type="range" min="0" max="100" step="25" style={{ background: `linear-gradient(to right, #ac88da ${settings.brightness}%, #444 ${settings.brightness}%)` }} value={settings.brightness} onChange={e => patch({ brightness: Number(e.target.value) })}/></label>
    {![6, 8].includes(effect) && <label>速度 <output>{settings.speed}%</output><input aria-label="速度" type="range" min="0" max="100" step="25" style={{ background: `linear-gradient(to right, #ac88da ${settings.speed}%, #444 ${settings.speed}%)` }} value={settings.speed} onChange={e => patch({ speed: Number(e.target.value) })}/></label>}
    {colorSelectable(effect) && <div className="lighting-color-row">
      <span>颜色</span>
      {effect !== 8 && <label className="rainbow-toggle"><input type="checkbox" aria-label="全彩" checked={settings.colorMode === 'rainbow'} onChange={e => patch({ colorMode: e.target.checked ? 'rainbow' : 'single', colorChanged: true })}/>全彩</label>}
      <input className={effect !== 8 && settings.colorMode === 'rainbow' ? 'rainbow-color-picker' : undefined} aria-label="单色" title="选择颜色" type="color" value={settings.color} onChange={e => patch({ color: e.target.value, colorMode: 'single', colorChanged: true })}/>
    </div>}
    {effect === 8 && <label>灯光<select aria-label="自定义开关" value={settings.enabled ? 'on' : 'off'} onChange={e => patch({ enabled: e.target.value === 'on' })}><option value="on">全亮</option><option value="off">全灭</option></select></label>}
  </div>
}
