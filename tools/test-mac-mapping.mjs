import test from 'node:test'
import assert from 'node:assert/strict'
import {MAC_MODIFIER_KEYS, logicalAssignment, isMacCompatibleAssignment, canAssignForMode, assignmentForMode, assertUniqueMacMappings, withKeymapLock} from '../src/mac-mapping.mjs'
import {makeProfile, validateProfile, setProfileAssignment, profileFromCurrent, parseProfile, resetProfileAssignments, referenceBytes} from '../src/profiles.mjs'
import {readAssignment, encodeKeymapWrite, assignmentLabel, experimentalTargets} from '../src/keymap.mjs'
import {A80Client} from '../src/transport.mjs'
import {crc16} from '../src/protocol.mjs'
import {systemModeKeyNote} from '../src/system-mode.mjs'

const baseProfile = () => validateProfile({...makeProfile(), experimental: true})
const targets = [[0x200800, 0x2110e3], [0x200400, 0x2110e2], [0x204000, 0x2110e6], [0x201000, 0x2110e4]]
function configured() {
  let profile = baseProfile()
  for (const [i, code] of Object.keys(MAC_MODIFIER_KEYS).entries()) profile = setProfileAssignment(profile, code, targets[i][0], 1)
  return profile
}

test('Mac edits convert library keys, unassigned and all eight single modifiers at the four overridden positions', () => {
  const base = baseProfile()
  const singleTargets = experimentalTargets.filter(t => t.assignment >>> 16 === 0x20)
  for (let bit = 0; bit < 8; bit++) assert.ok(singleTargets.some(t => t.assignment === (0x200000 | (1 << bit) << 8)))
  for (const [code, slot] of Object.entries(MAC_MODIFIER_KEYS)) {
    for (const {assignment: logical} of singleTargets) {
      const mask = logical >>> 8 & 255
      const encoded = 0x211000 | (mask ? 0xe0 + Math.log2(mask) : logical & 255)
      const draft = setProfileAssignment(base, code, logical, 1)
      assert.equal(readAssignment(draft.keymap, slot), encoded)
      assert.equal(logicalAssignment(encoded), logical)
      assert.equal(assignmentLabel(encoded), assignmentLabel(logical))
      assert.ok(draft.keymap.every((v, i) => Math.floor(i / 3) === slot || v === base.keymap[i]))
      assert.equal(readAssignment(setProfileAssignment(base, code, logical, 0).keymap, slot), logical)
    }
    for (const unsupported of [0x200300, 0x200104, 0x20009c, 0x2000df, 0x200001]) {
      assert.equal(canAssignForMode(code, unsupported, 1), false)
      assert.throws(() => assignmentForMode(code, unsupported, 1), /组合编码或超出范围/)
    }
    assert.equal(readAssignment(setProfileAssignment(base, code, 0x30e200, 1).keymap, slot), 0x30e200)
  }
  assert.equal(readAssignment(setProfileAssignment(base, 'KeyA', 0x200800, 1).keymap, 10), 0x200800)
})

test('profiles and current readback keep raw 21 bytes; export does not depend on display platform', () => {
  const draft = configured()
  const current = encodeKeymapWrite(Uint8Array.from(draft.keymap)), raw = current.slice()
  const read = profileFromCurrent(current, draft.name)
  assert.deepEqual(current, raw)
  assert.deepEqual(read, draft)
  assert.deepEqual(parseProfile(JSON.stringify(read)), draft)
  assert.ok(Object.values(MAC_MODIFIER_KEYS).every(slot => read.keymap[slot * 3] === 0x21))
  assert.deepEqual(resetProfileAssignments(read), baseProfile())
})

test('unknown 21 parameters and other physical slots remain closed', () => {
  for (const value of [0x2100e3, 0x2111e3, 0x211001, 0x211003, 0x21109c, 0x2110df, 0x2110e8]) {
    assert.equal(isMacCompatibleAssignment(12, value), false)
    const changed = baseProfile(); changed.keymap.splice(36, 3, value >>> 16, value >>> 8 & 255, value & 255)
    assert.throws(() => validateProfile(changed), /尚未开放/)
  }
  for (const slot of [10, 0, 5, 88]) {
    assert.equal(isMacCompatibleAssignment(slot, 0x2110e3), false)
    const changed = baseProfile(); changed.keymap.splice(slot * 3, 3, 0x21, 0x10, 0xe3)
    assert.throws(() => validateProfile(changed), /尚未开放/)
  }
})

test('multiple unassigned positions and ordinary targets can be round-tripped without a modifier conflict', () => {
  for (const assignment of [0x200000, 0x200004]) {
    let profile = baseProfile()
    for (const code of Object.keys(MAC_MODIFIER_KEYS)) profile = setProfileAssignment(profile, code, assignment, 1)
    assert.doesNotThrow(() => assertUniqueMacMappings(profile.keymap))
    assert.deepEqual(profileFromCurrent(Uint8Array.from(profile.keymap), profile.name), profile)
    assert.deepEqual(parseProfile(JSON.stringify(profile)), profile)
  }
  // A valid helper range is not permission to import an unlisted target.
  assert.equal(isMacCompatibleAssignment(12, 0x21109b), true)
  const unknown = baseProfile(); unknown.keymap.splice(36, 3, 0x21, 0x10, 0x9b)
  assert.throws(() => validateProfile(unknown), /尚未开放/)
})

test('Cmd/Opt can be swapped in a two-step draft; duplicate intermediate state is not writable', () => {
  const before = configured()
  const step1 = setProfileAssignment(before, 'MetaLeft', 0x200400, 1)
  assert.throws(() => assertUniqueMacMappings(step1.keymap), /不能重复/)
  const step2 = setProfileAssignment(step1, 'AltLeft', 0x200800, 1)
  assert.doesNotThrow(() => assertUniqueMacMappings(step2.keymap))
  assert.equal(readAssignment(step2.keymap, 12), 0x2110e2)
  assert.equal(readAssignment(step2.keymap, 19), 0x2110e3)
  assert.equal(readAssignment(before.keymap, 12), 0x2110e3)
})

test('an occupied keymap lock rejects a second page before its action starts', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  let occupied = true, called = false
  Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {locks: {
    async request(_name, options, action) {
      assert.equal(options.ifAvailable, true)
      return action(occupied ? null : {})
    },
  }}})
  try {
    await assert.rejects(withKeymapLock(() => { called = true }), /另一个页面/)
    assert.equal(called, false)
    occupied = false
    assert.equal(await withKeymapLock(() => 42), 42)
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original)
    else delete globalThis.navigator
  }
})

test('mode hints distinguish firmware override from applied compatibility mapping and host names', () => {
  assert.match(systemModeKeyNote(1, 'MetaLeft', 0x200800), /输出 L Alt/)
  assert.match(systemModeKeyNote(1, 'MetaLeft', 0x200800, 'macos'), /输出 L Opt/)
  assert.match(systemModeKeyNote(1, 'MetaLeft', 0x2110e3, 'macos'), /兼容映射：输出 L Cmd/)
  assert.equal(systemModeKeyNote(0, 'MetaLeft', 0x2110e3), '')
})

class Device extends EventTarget {
  opened = true; current = referenceBytes(); osMode = 1; sent = []; beforeModeRead = () => {}
  async close() { this.opened = false }
  async sendReport(id, request) {
    assert.equal(id, 4); this.sent.push(request.slice())
    const response = request.slice(), command = request[2], length = request[3], offset = request[4] | request[5] << 8
    if ([3, 5, 7, 8].includes(command)) {
      const crc = crc16(request.subarray(2)); response[0] = crc >> 8; response[1] = crc & 255
      if (command === 5 && offset === 44) { this.beforeModeRead(); response[7] = this.osMode }
      if (command === 7) response.set(referenceBytes().slice(offset, offset + length), 7)
      if (command === 8) response.set(this.current.slice(offset, offset + length), 7)
    }
    if (command === 9) this.current.set(request.slice(7, 7 + length), offset)
    const event = new Event('inputreport'); Object.assign(event, {reportId: 4, data: new DataView(response.buffer)}); this.dispatchEvent(event)
  }
}
const clientFor = device => new A80Client(device, {gap: 0, timeout: 100})

test('failed backup storage stops before any keymap write', async () => {
  const device = new Device(), client = clientFor(device)
  await assert.rejects(client.setProfile(configured(), () => { throw new Error('Storage full') }, {expectedOsMode: 1}), /Storage full/)
  assert.equal(device.sent.filter(r => r[2] === 9).length, 0)
  assert.deepEqual(device.current, referenceBytes())
  await client.close()
})

test('profile application rereads mode before backup/write and preserves every requested raw byte', async () => {
  const device = new Device(), client = clientFor(device), draft = configured()
  let backup
  const result = await client.setProfile(draft, bytes => { backup = bytes }, {expectedOsMode: 1})
  assert.deepEqual(backup, referenceBytes())
  assert.deepEqual(result.keymap, encodeKeymapWrite(Uint8Array.from(draft.keymap)))
  const modeIndex = device.sent.findIndex(r => r[2] === 5 && r[4] === 44)
  assert.ok(modeIndex >= 0 && modeIndex < device.sent.findIndex(r => r[2] === 9))
  assert.equal(device.sent.filter(r => r[2] === 9).length, 5)
  const reset = resetProfileAssignments(profileFromCurrent(result.keymap))
  assert.deepEqual((await client.setProfile(reset, () => {}, {expectedOsMode: 1})).keymap, encodeKeymapWrite(referenceBytes()))
  await client.close()
})

test('mode change after editing stops before any keymap write or backup callback', async () => {
  const device = new Device(), client = clientFor(device)
  device.beforeModeRead = () => { device.osMode = 0 }
  let backedUp = false
  await assert.rejects(client.setProfile(configured(), () => { backedUp = true }, {expectedOsMode: 1}), /模式已变化/)
  assert.equal(backedUp, false)
  assert.equal(device.sent.filter(r => r[2] === 9).length, 0)
  assert.deepEqual(device.current, referenceBytes())
  await client.close()
})

test('duplicate imports and unrecognized modes never reach device writes', async () => {
  const device = new Device(), client = clientFor(device)
  const duplicate = setProfileAssignment(configured(), 'AltLeft', 0x200800, 1)
  await assert.rejects(client.setProfile(parseProfile(JSON.stringify(duplicate))), /不能重复/)
  for (const expectedOsMode of [undefined, 2, 255]) await assert.rejects(client.setProfile(configured(), () => {}, {expectedOsMode}), /模式未识别/)
  assert.equal(device.sent.length, 0)
  await client.close()
})
