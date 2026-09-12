import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { rows } from '../keyboard'
import { KeyLegend } from './KeyLegend'
import { Select } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import { previewLight, type LightPulse, type LightingPreviewSettings } from '../lighting-preview'

type Props = {
  systemMode: string; page: string; effect: number; selected: string; tested: Set<string>; pressed: Set<string>
  onSelect: (code: string) => void
  keyName: (code: string, fallback: string) => string
  previewSettings: LightingPreviewSettings
}
const darkKeys = new Set(['Escape', 'Tab', 'CapsLock', 'Backspace', 'Enter', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'MetaLeft', 'AltLeft', 'AltRight', 'Fn', 'PrintScreen', 'Delete', 'F5', 'F6', 'F7', 'F8', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'])
const centeredKeys = new Set(['Backslash', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Delete', 'PrintScreen', 'MetaLeft', 'AltLeft', 'AltRight', 'Fn', 'Escape', 'ControlRight', 'Space'])
const rightAlignedKeys = new Set(['Backspace', 'Enter', 'ShiftRight'])
const accentKeys = {
  a80: new Set(['Space', 'PageUp', 'PageDown', 'Home', 'End']),
  l80: new Set(['Escape', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']),
}
const positions = new Map(rows.flatMap((row, y) => {
  let x = 0
  return row.map(key => { x += key.gap ?? 0; const position = { x: x + key.width / 2, y }; x += key.width; return [key.code, position] as const })
}))
export function KeyboardPreview({ systemMode, page, effect, selected, tested, pressed, onSelect, keyName, previewSettings }: Props) {
  const [appearance, setAppearance] = useState<'a80' | 'l80'>('a80')
  const viewportRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 760, height: 320 })
  const scale = Math.min(1, dimensions.width / 760)
  const tooSmall = dimensions.width < 440
  useEffect(() => {
    const viewport = viewportRef.current
    const board = boardRef.current
    if (!viewport || !board) return
    const measure = () => setDimensions({ width: viewport.clientWidth, height: board.offsetHeight })
    const observer = new ResizeObserver(measure)
    observer.observe(viewport); observer.observe(board)
    measure()
    return () => observer.disconnect()
  }, [])
  const [lightFrame, setLightFrame] = useState<{ time: number; pulses: LightPulse[] }>({ time: 0, pulses: [] })
  const pulses = useRef<LightPulse[]>([])
  const pulseIndex = useRef(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const triggerPulse = (code: string) => {
    const position = positions.get(code)
    if (!position) return
    pulses.current = [...pulses.current.slice(-23), { code, ...position, time: performance.now() / 1000, hue: pulseIndex.current++ * 60 % 360 }]
  }
  useEffect(() => {
    if (page !== 'lighting') return
    pulses.current = []
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReducedMotion(preference.matches)
    updatePreference()
    preference.addEventListener('change', updatePreference)
    let frame = 0
    let last = 0
    const tick = (now: number) => {
      if (now - last >= 33) {
        pulses.current = pulses.current.filter(pulse => now / 1000 - pulse.time < 12)
        setLightFrame({ time: now / 1000, pulses: pulses.current })
        last = now
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    const trigger = (event: KeyboardEvent) => {
      if (event.repeat || (event.target as HTMLElement).closest('input,textarea,select,button:not(.keycap)')) return
      triggerPulse(event.code)
    }
    window.addEventListener('keydown', trigger)
    return () => { window.removeEventListener('keydown', trigger); preference.removeEventListener('change', updatePreference); cancelAnimationFrame(frame) }
  }, [page, effect])
  return <>
    <div className="appearance-picker">
      <Select.Root value={appearance} onValueChange={value => setAppearance(value as 'a80' | 'l80')}>
        <Select.Trigger className="appearance-trigger" aria-label="键盘外观参考" title="仅切换外观，当前通信适配 A80"><Select.Value/><Select.Icon><ChevronDown size={13}/></Select.Icon></Select.Trigger>
        <Select.Portal><Select.Content className="appearance-menu" position="popper" sideOffset={5}>
          <Select.Viewport>{(['a80', 'l80'] as const).map(value => <Select.Item className="appearance-option" key={value} value={value}>
            <Select.ItemText>{value.toUpperCase()}</Select.ItemText><Select.ItemIndicator><Check size={14}/></Select.ItemIndicator>
          </Select.Item>)}</Select.Viewport>
        </Select.Content></Select.Portal>
      </Select.Root>
      <span className="system-mode" title="键盘当前系统模式，以设备读取结果为准">{systemMode === '未读取' ? 'Windows / Mac · 未读取' : `${systemMode} 模式`}</span>
    </div>
    <div ref={viewportRef} className="keyboard-viewport">
    {tooSmall && <div className="keyboard-unavailable" role="status">空间不足，无法展示键盘。请扩大窗口或横屏查看。</div>}
    <div className="keyboard-scale-stage" aria-hidden={tooSmall} inert={tooSmall} style={{ height: tooSmall ? 0 : dimensions.height * scale, visibility: tooSmall ? 'hidden' : 'visible' }}>
    <div ref={boardRef} style={{ transform: `scale(${scale})` }} className={`keyboard-case physical-board ${appearance} ${page === 'lighting' ? `lit effect-${effect}` : ''}`}>
      {appearance === 'a80' && <div className="a80-trim" aria-hidden="true"><i/></div>}
      {[rows.slice(0, 1), rows.slice(1)].map((group, groupIndex) => <div className={`key-well ${groupIndex === 0 ? 'function-well' : 'main-well'}`} key={groupIndex}>
      {group.map((row, rowIndex) => {
        const i = groupIndex === 0 ? 0 : rowIndex + 1
        let column = 1
        return <div className={`keyboard-row physical-row ${i === 0 ? 'function-row' : ''}`} key={i}>
          {i === 0 && <div className="indicator-slot" title="指示灯位置（装饰示意）" aria-hidden="true"><i/></div>}
          {row.map(key => {
            column += (key.gap ?? 0) * 4
            const start = column; column += key.width * 4
            const position = positions.get(key.code)!
            const light = previewLight(effect, key.code, position.x, position.y, lightFrame.time, previewSettings, lightFrame.pulses, reducedMotion)
            const label = page === 'keymap' ? keyName(key.code, key.label) : key.label || 'Space'
            const alignment = centeredKeys.has(key.code) ? 'center' : rightAlignedKeys.has(key.code) ? 'right' : 'left'
            return <div className="key-position" key={key.code} style={{ gridColumn: `${start} / span ${key.width * 4}` } as CSSProperties}>
              {page === 'lighting' && <span aria-hidden="true" className="key-backlight" style={{ '--preview-light': light.color, opacity: light.opacity } as CSSProperties}/>}
              <button
              className={`keycap legend-${alignment} ${darkKeys.has(key.code) ? 'dark-key' : 'light-key'} ${accentKeys[appearance].has(key.code) ? 'accent-key' : ''} ${selected === key.code && page === 'keymap' ? 'selected-key' : ''} ${page === 'tester' && tested.has(key.code) ? 'tested' : ''} ${page === 'tester' && pressed.has(key.code) ? 'pressed' : ''}`}
              title={`${key.label || 'Space'} · ${key.code}`} aria-label={key.code} aria-pressed={selected === key.code && page === 'keymap'} onClick={() => { onSelect(key.code); if (page === 'lighting') triggerPulse(key.code) }}>
              <KeyLegend label={label}/>
            </button></div>
          })}
        </div>
      })}
      </div>)}
    </div>
    </div>
    </div>
  </>
}
