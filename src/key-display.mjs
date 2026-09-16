import {assignmentLabel} from './keymap.mjs'
import {logicalAssignment} from './mac-mapping.mjs'

// Host key names are a display preference, independent of the keyboard's mode.
export function detectKeyPlatform(navLike = globalThis.navigator) {
  for (const value of [navLike?.userAgentData?.platform, navLike?.platform]) {
    if (typeof value !== 'string') continue
    const platform = value.trim().toLowerCase()
    if (platform.startsWith('mac')) return 'macos'
    if (platform.startsWith('win')) return 'windows'
  }
  return 'windows'
}

export function resolveKeyPlatform(preference, navLike = globalThis.navigator) {
  return preference === 'windows' || preference === 'macos'
    ? preference
    : detectKeyPlatform(navLike)
}

const macPhysicalAssignments = new Map([
  [12, 0x200400], // Physical L Win -> L Alt
  [19, 0x200800], // Physical L Alt -> L Win
  [61, 0x208000], // Physical R Alt -> R Win
  [75, 0x204000], // Physical R Ctrl -> R Alt
])

export function effectiveAssignment(assignment, slot, deviceMode) {
  // Check the RAW category first. Decoded 21 actions deliberately bypass this
  // firmware override and must not accidentally be treated as raw 20 actions.
  if (deviceMode === 1 && (assignment >>> 16) === 0x20 && macPhysicalAssignments.has(slot)) {
    return macPhysicalAssignments.get(slot)
  }
  return logicalAssignment(assignment)
}

const modifiers = new Map([
  [0x200100, ['L', 'Ctrl']],
  [0x200200, ['L', 'Shift']],
  [0x200400, ['L', 'Alt']],
  [0x200800, ['L', 'Win']],
  [0x201000, ['R', 'Ctrl']],
  [0x202000, ['R', 'Shift']],
  [0x204000, ['R', 'Alt']],
  [0x208000, ['R', 'Win']],
])

export function keyDisplayLabel(assignment, platform) {
  const logical = logicalAssignment(assignment)
  const modifier = modifiers.get(logical)
  if (!modifier) return assignmentLabel(logical)
  const [side, key] = modifier
  const name = platform === 'macos' ? ({Win: 'Cmd', Alt: 'Opt'}[key] ?? key) : key
  return `${side} ${name}`
}
