// The four physical positions and E2/E3/E4/E6 passed hardware tests on Windows.
// Other single usages follow the same audited 21/10 -> 1eb94 route. They remain
// experimental; an ordinary usage and a modifier cannot be combined in 21/10.
export const MAC_MODIFIER_KEYS = Object.freeze({MetaLeft: 12, AltLeft: 19, AltRight: 61, ControlRight: 75})
// Retain the original lock name to coordinate with already-open older clients.
const KEYMAP_WRITE_LOCK = 'shiqunix.mac-usage-probe.v1'
export function withKeymapLock(action) {
  if (!globalThis.navigator?.locks) return action()
  return navigator.locks.request(KEYMAP_WRITE_LOCK, {ifAvailable: true}, lock => {
    if (!lock) throw new Error('另一个页面正在修改键位，请等待其完成。')
    return action()
  })
}
const slots = Object.values(MAC_MODIFIER_KEYS)
const modifierNames = ['L Ctrl', 'L Shift', 'L Alt', 'L Win', 'R Ctrl', 'R Shift', 'R Alt', 'R Win']
const ordinaryUsage = usage => usage === 0 || usage >= 4 && usage <= 0x9b
function encodedUsage(value) {
  if (!Number.isInteger(value) || value >>> 8 !== 0x2110) return null
  const usage = value & 255
  return ordinaryUsage(usage) || usage >= 0xe0 && usage <= 0xe7 ? usage : null
}
export function logicalAssignment(value) {
  const usage = encodedUsage(value)
  if (usage === null) return value
  return usage >= 0xe0 ? 0x200000 | (1 << (usage - 0xe0)) << 8 : 0x200000 | usage
}
function targetUsage(value) {
  if (!Number.isInteger(value) || value >>> 16 !== 0x20) return null
  const mask = value >>> 8 & 255, usage = value & 255
  if (mask === 0 && ordinaryUsage(usage)) return usage
  if (usage === 0 && mask !== 0 && (mask & (mask - 1)) === 0) return 0xe0 + Math.log2(mask)
  return null
}
export const isMacCompatibleAssignment = (slot, value) => slots.includes(slot) && encodedUsage(value) !== null
export const isMacModifierKey = code => Object.hasOwn(MAC_MODIFIER_KEYS, code)
export function canAssignForMode(code, value, mode) {
  return mode !== 1 || !isMacModifierKey(code) || value >>> 16 !== 0x20 || targetUsage(value) !== null
}
export function assignmentForMode(code, value, mode) {
  if (!canAssignForMode(code, value, mode)) throw new Error('Mac 兼容映射暂不支持此组合编码或超出范围的键码。')
  if (mode === 1 && isMacModifierKey(code) && value >>> 16 === 0x20) return 0x211000 | targetUsage(value)
  return value
}
export function macMappings(keymap) {
  if (!keymap) return []
  return Object.entries(MAC_MODIFIER_KEYS).flatMap(([code, slot]) => {
    const value = keymap[slot * 3] << 16 | keymap[slot * 3 + 1] << 8 | keymap[slot * 3 + 2]
    const usage = encodedUsage(value)
    return usage === null ? [] : [{code, slot, usage, assignment: logicalAssignment(value), encoded: value, label: modifierNames[usage - 0xe0] ?? ''}]
  })
}
export function assertUniqueMacMappings(keymap) {
  const used = new Set()
  for (const target of macMappings(keymap)) {
    // 00 is inert and may be used at multiple positions. Ordinary duplicate
    // keys retain the firmware's existing behavior, as in native 20 mappings.
    if (target.usage < 0xe0) continue
    if (used.has(target.encoded)) throw new Error(`Mac 兼容映射不能重复使用 ${target.label}：松开一个实体键会同时释放相同目标。`)
    used.add(target.encoded)
  }
}
