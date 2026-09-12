export type LightingPreviewSettings = { brightness: number; speed: number; colorMode: 'rainbow' | 'single'; color: string; enabled: boolean; colorChanged?: boolean }
export type LightPulse = { code: string; x: number; y: number; time: number; hue: number }
export const defaultPreviewSettings = (): LightingPreviewSettings => ({ brightness: 80, speed: 50, colorMode: 'rainbow', color: '#40dfff', enabled: true })
export const colorSelectable = (effect: number) => [1, 4, 5, 6, 8].includes(effect)
const randomHue = (seed: number) => ((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1 * 360
const hueColor = (hue: number) => `hsl(${hue} 95% 62%)`

export function previewLight(effect: number, code: string, x: number, y: number, time: number, settings: LightingPreviewSettings, pulses: LightPulse[], reducedMotion = false) {
  const rate = .3 + settings.speed / 100 * 2.2
  const t = reducedMotion ? 0 : time * rate
  let hue = x * 23
  let intensity = 1
  if (effect === 1) {
    hue -= t * 85 // Constant phase travels toward increasing x.
    if (settings.colorMode === 'single') intensity = .15 + .85 * ((Math.cos(hue * Math.PI / 180) + 1) / 2) ** 3
  }
  if (effect === 2) hue = t * 38
  if (effect === 3) {
    const cycle = t / 3.5
    hue = Math.floor(cycle) * 60
    const phase = cycle % 1
    intensity = reducedMotion ? .6 : phase < .12 || phase > .88 ? 0 : Math.sin((phase - .12) / .76 * Math.PI) ** 2
  }
  if (effect === 4 || effect === 5) {
    intensity = 0
    for (const pulse of pulses) {
      if (effect === 4 && pulse.code !== code) continue
      const age = (time - pulse.time) * rate
      const delay = effect === 5 ? Math.hypot(x - pulse.x, y - pulse.y) * .1 : 0
      const elapsed = age - delay
      const glow = elapsed >= 0 && elapsed < 1.1 ? (1 - elapsed / 1.1) ** 2 : 0
      if (glow > intensity) { intensity = glow; hue = pulse.hue }
    }
  }
  if (effect === 6) hue = randomHue(x * 7 + y * 31)
  if (effect === 7) {
    const seed = x * 7 + y * 31
    const phase = t / 2 + randomHue(seed) / 360
    const step = Math.floor(phase)
    const from = randomHue(seed + step * 17)
    const to = randomHue(seed + (step + 1) * 17)
    const blend = phase % 1
    hue = from + ((to - from + 540) % 360 - 180) * blend * blend * (3 - 2 * blend)
  }
  if (effect === 8 && !settings.enabled) intensity = 0
  return {
    color: effect === 8 || (colorSelectable(effect) && settings.colorMode === 'single') ? settings.color : hueColor(hue),
    opacity: intensity * settings.brightness / 100,
  }
}
