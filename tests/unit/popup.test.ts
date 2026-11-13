import { afterEach, describe, expect, it, vi } from 'vitest'
import { openConnectPopup, WeavzClient } from '../../src/client'

const url = 'https://platform.example.com/connect?token=example'
const result = { type: 'weavz-connect-result', status: 'success', connectionId: 'connection', integrationName: 'example', externalId: 'customer' }
function browser(popup: { closed: boolean } | null = { closed: false }) {
  const listeners = new Set<(event: MessageEvent) => void>()
  const remove = vi.fn((_name, fn) => listeners.delete(fn))
  vi.stubGlobal('window', { open: vi.fn(() => popup), addEventListener: (_name: string, fn: (event: MessageEvent) => void) => listeners.add(fn), removeEventListener: remove })
  const send = (data = result, origin = 'https://platform.example.com', source: unknown = popup) => listeners.forEach(fn => fn({ data, origin, source } as MessageEvent))
  return { popup, send, listeners }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('hosted connect popup', () => {
  it('opens the Hosted Connect URL without an API-key client', async () => {
    const { send } = browser()
    const promise = openConnectPopup({ connectUrl: url })
    send()
    await expect(promise).resolves.toMatchObject({ connectionId: 'connection' })
  })
  it('fails promptly when used outside a browser', async () => {
    const client = new WeavzClient({ apiKey: 'wvz_example' })
    await expect(client.connect.popup({ token: 'example', connectUrl: url })).rejects.toMatchObject({ code: 'BROWSER_REQUIRED' })
  })
  it('fails promptly when the popup is blocked', async () => {
    const { listeners } = browser(null)
    const client = new WeavzClient({ apiKey: 'wvz_example' })
    await expect(client.connect.popup({ token: 'example', connectUrl: url })).rejects.toMatchObject({ code: 'POPUP_BLOCKED' })
    expect(listeners.size).toBe(0)
  })
  it('requires both the expected origin and popup source before accepting a complete result', async () => {
    vi.useFakeTimers()
    const { send, listeners } = browser()
    const client = new WeavzClient({ apiKey: 'wvz_example' })
    const finished = vi.fn()
    const promise = client.connect.popup({ token: 'example', connectUrl: url }).then(value => { finished(); return value })
    send(result, '')
    send(result, 'https://attacker.example.com')
    send(result, 'https://platform.example.com', {})
    send({ ...result, connectionId: '' })
    await Promise.resolve()
    expect(finished).not.toHaveBeenCalled()
    expect(listeners.size).toBe(1)
    send()
    await expect(promise).resolves.toEqual({ connectionId: 'connection', integrationName: 'example', externalId: 'customer' })
    expect(listeners.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('cleans up timers and listeners after a popup closes without completing', async () => {
    vi.useFakeTimers()
    const { popup, listeners } = browser()
    const client = new WeavzClient({ apiKey: 'wvz_example' })
    const failure = expect(client.connect.popup({ token: 'example', connectUrl: url })).rejects.toThrow('Popup closed before completing')
    popup!.closed = true
    await vi.advanceTimersByTimeAsync(3500)
    await failure
    expect(listeners.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})
