import test from 'node:test'
import assert from 'node:assert/strict'
import {detectKeyPlatform, resolveKeyPlatform, effectiveAssignment, keyDisplayLabel} from '../src/key-display.mjs'

test('detect display platform from client hints, then legacy platform', () => {
  assert.equal(detectKeyPlatform({userAgentData: {platform: 'macOS'}, platform: 'Win32'}), 'macos')
  assert.equal(detectKeyPlatform({userAgentData: {platform: 'Windows'}, platform: 'MacIntel'}), 'windows')
  assert.equal(detectKeyPlatform({platform: 'MacIntel'}), 'macos')
  assert.equal(detectKeyPlatform({platform: 'Win32'}), 'windows')
  assert.equal(detectKeyPlatform({userAgentData: {platform: ''}, platform: 'MacIntel'}), 'macos')
  assert.equal(detectKeyPlatform({userAgentData: {platform: 'Unknown'}, platform: 'MacIntel'}), 'macos')
  assert.equal(detectKeyPlatform({platform: 'Linux x86_64'}), 'windows')
  assert.equal(detectKeyPlatform({}), 'windows')
  assert.equal(detectKeyPlatform(null), 'windows')
})

test('manual key naming overrides host detection without changing a device mode', () => {
  const mac = {platform: 'MacIntel'}, win = {platform: 'Win32'}
  assert.equal(resolveKeyPlatform('auto', mac), 'macos')
  assert.equal(resolveKeyPlatform('auto', win), 'windows')
  assert.equal(resolveKeyPlatform('windows', mac), 'windows')
  assert.equal(resolveKeyPlatform('macos', win), 'macos')
  assert.equal(resolveKeyPlatform(undefined, mac), 'macos')
})

test('device mode and host naming are independent in all four combinations', () => {
  const raw = 0x200800, slot = 12
  const cases = [
    [0, 'windows', 0x200800, 'L Win'],
    [0, 'macos', 0x200800, 'L Cmd'],
    [1, 'windows', 0x200400, 'L Alt'],
    [1, 'macos', 0x200400, 'L Opt'],
  ]
  for (const [deviceMode, platform, expected, label] of cases) {
    const effective = effectiveAssignment(raw, slot, deviceMode)
    assert.equal(effective, expected)
    assert.equal(keyDisplayLabel(effective, platform), label)
  }
})

test('raw ordinary actions at all four Mac positions reflect physical override', () => {
  for (const [slot, expected] of [[12, 0x200400], [19, 0x200800], [61, 0x208000], [75, 0x204000]]) {
    // Even an A or unassigned mapping at these positions is overridden by the
    // firmware in Mac mode; the displayed effective action should reflect that.
    assert.equal(effectiveAssignment(0x200004, slot, 1), expected)
    assert.equal(effectiveAssignment(0x200000, slot, 1), expected)
    assert.equal(effectiveAssignment(0x200004, slot, 0), 0x200004)
  }
})

test('ordinary keys outside the overridden positions keep their assignment and label', () => {
  for (const mode of [0, 1]) {
    for (const platform of ['windows', 'macos']) {
      assert.equal(effectiveAssignment(0x200004, 10, mode), 0x200004)
      assert.equal(keyDisplayLabel(0x200004, platform), 'A')
      assert.equal(effectiveAssignment(0x200800, 10, mode), 0x200800)
      assert.equal(keyDisplayLabel(effectiveAssignment(0x200800, 10, mode), platform), platform === 'macos' ? 'L Cmd' : 'L Win')
    }
  }
})

test('decoded 21 actions bypass Mac physical override in every affected position', () => {
  const targets = [[0x2110e2, 0x200400], [0x2110e3, 0x200800], [0x2110e4, 0x201000], [0x2110e6, 0x204000], [0x2110e0, 0x200100], [0x2110e1, 0x200200], [0x2110e5, 0x202000], [0x2110e7, 0x208000], [0x211004, 0x200004], [0x211000, 0x200000]]
  for (const [raw, logical] of targets) {
    for (const slot of [12, 19, 61, 75]) {
      assert.equal(effectiveAssignment(raw, slot, 1), logical)
      assert.equal(effectiveAssignment(raw, slot, 0), logical)
    }
    assert.equal(keyDisplayLabel(raw, 'windows'), keyDisplayLabel(logical, 'windows'))
    assert.equal(keyDisplayLabel(raw, 'macos'), keyDisplayLabel(logical, 'macos'))
  }
})

test('unknown device modes never fabricate a Mac override', () => {
  for (const mode of [undefined, null, 2, 255, '1']) {
    assert.equal(effectiveAssignment(0x200800, 12, mode), 0x200800)
    assert.equal(effectiveAssignment(0x2110e3, 12, mode), 0x200800)
  }
  assert.equal(effectiveAssignment(0x200800, undefined, 1), 0x200800)
  assert.equal(effectiveAssignment(0x200800, '12', 1), 0x200800)
})

test('all eight modifier labels use the selected host naming convention', () => {
  const names = [
    [0x200100, 'L Ctrl', 'L Ctrl'], [0x200200, 'L Shift', 'L Shift'],
    [0x200400, 'L Alt', 'L Opt'], [0x200800, 'L Win', 'L Cmd'],
    [0x201000, 'R Ctrl', 'R Ctrl'], [0x202000, 'R Shift', 'R Shift'],
    [0x204000, 'R Alt', 'R Opt'], [0x208000, 'R Win', 'R Cmd'],
  ]
  for (const [assignment, windows, macos] of names) {
    assert.equal(keyDisplayLabel(assignment, 'windows'), windows)
    assert.equal(keyDisplayLabel(assignment, 'macos'), macos)
  }
})

test('media and unknown actions retain their own labels and do not get an override', () => {
  for (const mode of [0, 1, undefined]) {
    assert.equal(effectiveAssignment(0x30e200, 12, mode), 0x30e200)
    assert.equal(effectiveAssignment(0x2110e8, 12, mode), 0x2110e8)
  }
  assert.equal(keyDisplayLabel(0x30e200, 'macos'), 'Mute')
  assert.equal(keyDisplayLabel(0x30e200, 'windows'), 'Mute')
  assert.equal(keyDisplayLabel(0x2110e8, 'macos'), '0x2110E8')
})
