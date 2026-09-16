import type { LightingPreviewSettings } from './lighting-preview'
import { useEffect, useRef, useState } from 'react'
import { A80Client, chooseDevice } from './transport.mjs'
import { profileFromCurrent, setProfileAssignment, resetProfileAssignments, parseProfile } from './profiles.mjs'
import { withKeymapLock } from './mac-mapping.mjs'
type Snapshot = Awaited<ReturnType<A80Client['readSnapshot']>>
type Profile = ReturnType<typeof profileFromCurrent>
type Log = { time: string; direction: string; data: number[]; reportId: number }
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, (_, v) => v instanceof Uint8Array ? [...v] : v, 2)], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function useKeyboard() {
  const client = useRef<A80Client | null>(null)
  const operation = useRef(false)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [draft, setDraft] = useState<Profile | null>(null)
  const [dirty, setDirty] = useState(false)
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('连接 A80，读取键盘当前配置后开始编辑。')
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<Log[]>([])
  const [backup, setBackup] = useState<Uint8Array | null>(null)
  async function run(action: () => Promise<void>) {
    if (operation.current) return
    operation.current = true; setBusy(true); setError('')
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { operation.current = false; setBusy(false) }
  }
  function accept(next: Snapshot) {
    setSnapshot(next); setDraft(null); setDirty(false)
    try { setDraft(profileFromCurrent(next.currentKeymap)) } catch (e) { setError(`已读取设备，但当前动作无法在键位库中编辑：${(e as Error).message}`) }
  }
  const connect = () => run(async () => {
    if (client.current) return
    const device = await chooseDevice(); if (!device) return
    const next = new A80Client(device, { onLog: (entry: Log) => setLogs(old => [...old.slice(-499), entry]) })
    client.current = next; setConnected(true); accept(await next.readSnapshot()); setMessage('已读取当前键位与灯效。选择实体键，再选择下方目标键。')
  })
  const disconnect = () => run(async () => {
    if (!client.current) return
    await client.current.close()
    client.current = null; setConnected(false); setSnapshot(null); setDraft(null); setDirty(false)
    setMessage('已断开连接。')
  })
  const refresh = () => run(async () => { if (!client.current) return; accept(await client.current.readSnapshot()); setMessage('已重新读取键盘，草稿同步为设备当前配置。') })
  const assign = (code: string, value: number) => {
    if (!draft || busy) return
    try { setDraft(setProfileAssignment(draft, code, value, snapshot?.osMode)); setDirty(true); setError(''); setMessage('修改已加入草稿，点击「应用修改」写入键盘。') } catch (e) { setError((e as Error).message) }
  }
  const apply = () => run(() => withKeymapLock(async () => {
    if (!client.current || !draft || !snapshot) return
    try {
      const result = await client.current.setProfile(draft, (bytes: Uint8Array) => {
        setBackup(bytes); localStorage.setItem('shiqunix.last-backup', JSON.stringify({ time: new Date().toISOString(), keymap: [...bytes] }))
      }, { expectedOsMode: snapshot.osMode })
      setSnapshot({ ...snapshot, currentKeymap: result.keymap }); setDraft(profileFromCurrent(result.keymap)); setDirty(false); setMessage('应用成功，当前键位表已完整读回核对。请测试实际输入。')
    } catch (e) { setSnapshot(null); throw e }
  }))
  const resetKeymap = () => {
    if (!draft || !connected || !snapshot || busy) return
    try {
      setDraft(resetProfileAssignments(draft)); setDirty(true); setError('')
      setMessage('全部键位已恢复为默认映射草稿，点击「应用修改」后生效。')
    } catch (e) { setError((e as Error).message) }
  }
  const lighting = (mode: number, settings: LightingPreviewSettings) => run(async () => {
    if (!client.current || !snapshot) return
    const result = await client.current.setLighting(mode, settings); setSnapshot({ ...snapshot, config: result.config }); setMessage(result.verification === 'custom-echo-only' ? '自定义已发送并收到完整回显；请确认实体键盘全亮／全灭，尚未验证断电保存。' : '灯效参数已应用，配置读回核对成功。')
  })
  const importFile = (file: File) => run(async () => {
    if (file.size > 32768) throw new Error('配置文件过大。')
    setDraft({ ...parseProfile(await file.text()), experimental: true }); setDirty(true); setMessage('配置已导入草稿，尚未写入键盘。')
  })
  useEffect(() => {
    const hid = (navigator as Navigator & { hid?: EventTarget }).hid
    const disconnect = (event: Event) => {
      if ((event as Event & { device: unknown }).device !== client.current?.device) return
      void client.current?.close().catch(() => {}); client.current = null; setConnected(false); setSnapshot(null); setDraft(null); setDirty(false); setError('键盘已断开，请重新连接。')
    }
    hid?.addEventListener('disconnect', disconnect)
    return () => { hid?.removeEventListener('disconnect', disconnect); void client.current?.close().catch(() => {}); client.current = null }
  }, [])
  return { snapshot, draft, dirty, connected, busy, message, error, logs, backup, connect, disconnect, refresh, assign, apply, resetKeymap, lighting, importFile }
}
