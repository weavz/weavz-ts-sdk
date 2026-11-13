import { afterEach, describe, expect, it, vi } from 'vitest'
import { WeavzClient } from '../../src/client'
import { WeavzError } from '../../src/errors'

function setup(responses: Array<Response | Error> = [Response.json({ ok: true })], options: Record<string, unknown> = {}) {
  const fetch = vi.fn(async () => {
    const response = responses.shift() ?? Response.json({ ok: true })
    if (response instanceof Error) throw response
    return response
  })
  const client = new WeavzClient({ apiKey: 'wvz_example', maxRetries: 0, fetch: fetch as typeof globalThis.fetch, ...options })
  return { client, fetch }
}

function abortingFetch() {
  return vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    const signal = init!.signal!
    if (signal.aborted) reject(signal.reason)
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  }))
}

afterEach(() => vi.useRealTimers())

describe('request transport', () => {
  it('merges query parameters and normalizes auth headers without mutating caller configuration', async () => {
    const headers = { authorization: 'ignored', 'content-type': 'text/plain' }
    const { client, fetch } = setup(undefined, { headers, userAgent: 'example/1.0' })
    await client.request('/api/v1/workspaces?offset=3', { method: 'get', params: { limit: 2, includeSuspended: false } })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(new URL(url).searchParams.get('offset')).toBe('3')
    expect(new URL(url).searchParams.get('limit')).toBe('2')
    expect(new URL(url).searchParams.get('includeSuspended')).toBe('false')
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer wvz_example')
    expect(init.method).toBe('GET')
    expect(headers).toEqual({ authorization: 'ignored', 'content-type': 'text/plain' })
  })

  it('encodes resource identifiers instead of treating them as routes or query strings', async () => {
    const { client, fetch } = setup()
    await client.workspaces.get('a/b?c#d')
    expect(new URL(fetch.mock.calls[0][0] as unknown as string).pathname).toBe('/api/v1/workspaces/a%2Fb%3Fc%23d')
  })

  it.each(['https://other.example/api/v1/workspaces', '//other.example/api/v1/workspaces'])('rejects a non-relative request path: %s', async path => {
    const { client, fetch } = setup()
    await expect(client.request(path)).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects an empty connection selector instead of returning a list with the wrong shape', async () => {
    const { client, fetch } = setup()
    await expect(client.connections.get('')).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([['timeout', 0], ['timeout', Infinity], ['timeout', -1], ['maxRetries', -1], ['maxRetries', 0.5], ['maxRetries', Infinity]])('rejects invalid %s=%s', (key, value) => {
    expect(() => setup(undefined, { [key]: value })).toThrow(TypeError)
  })

  it.each(['ftp://example.com', 'https://user:password@example.com', 'https://example.com?key=value', 'https://example.com#fragment'])('rejects an unusable base URL: %s', baseUrl => {
    expect(() => setup(undefined, { baseUrl })).toThrow(TypeError)
  })

  it('preserves a configured URL path prefix', async () => {
    const { client, fetch } = setup(undefined, { baseUrl: 'https://api.example.com/proxy/' })
    await client.workspaces.list()
    expect(fetch.mock.calls[0][0]).toBe('https://api.example.com/proxy/api/v1/workspaces')
  })

  it('returns undefined for a successful no-content response', async () => {
    const { client } = setup([new Response(null, { status: 204 })])
    await expect(client.workspaces.delete('workspace')).resolves.toBeUndefined()
  })

  it('wraps malformed successful JSON as an SDK error', async () => {
    const { client } = setup([new Response('{', { status: 200 })])
    await expect(client.workspaces.list()).rejects.toMatchObject({ name: 'WeavzError', code: 'INVALID_RESPONSE', status: 200 })
  })

  it('handles null JSON error responses without throwing a raw TypeError', async () => {
    const { client } = setup([Response.json(null, { status: 403 })])
    await expect(client.workspaces.list()).rejects.toBeInstanceOf(WeavzError)
  })

  it('retains structured application errors for JSON-compatible media types', async () => {
    const { client } = setup([new Response(JSON.stringify({ error: 'Denied', code: 'SCOPE_DENIED', details: { scope: 'workspace' } }), { status: 403, headers: { 'Content-Type': 'application/problem+json' } })])
    await expect(client.workspaces.list()).rejects.toMatchObject({ message: 'Denied', code: 'SCOPE_DENIED', status: 403, details: { scope: 'workspace' } })
  })

  it('rejects non-serializable input before sending a request', async () => {
    const { client, fetch } = setup()
    const body: Record<string, unknown> = {}; body.self = body
    await expect(client.request('/api/v1/workspaces', { method: 'POST', body })).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not retry a mutation after an ambiguous network failure', async () => {
    const { client, fetch } = setup([new TypeError('Connection lost')], { maxRetries: 2 })
    await expect(client.workspaces.create({ name: 'Example', slug: 'example' })).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each(['workspace', 'action', 'token'] as const)('does not replay a %s POST after a server failure', async kind => {
    const { client, fetch } = setup([new Response('Server failed', { status: 503 })], { maxRetries: 2 })
    const request = kind === 'workspace' ? client.workspaces.create({ name: 'Example', slug: 'example' })
      : kind === 'action' ? client.actions.execute('custom-example', 'send', { workspaceId: 'workspace', input: {} })
      : client.connect.createToken({ integrationName: 'example', connectionName: 'Example', externalId: 'customer', workspaceId: 'workspace' })
    await expect(request).rejects.toMatchObject({ status: 503 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries an action only after a pre-execution rate-limit denial', async () => {
    vi.useFakeTimers()
    const { client, fetch } = setup([Response.json({ code: 'RATE_LIMITED', error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '0' } }), Response.json({ success: true, output: 'sent', duration: 1 })], { maxRetries: 1 })
    const request = client.actions.execute('custom-example', 'send', { workspaceId: 'workspace' })
    await vi.advanceTimersByTimeAsync(0)
    await expect(request).resolves.toMatchObject({ success: true })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('retries a transient read failure and reports its attempt', async () => {
    vi.useFakeTimers()
    const onRetry = vi.fn()
    const { client, fetch } = setup([new TypeError('Connection lost'), Response.json({ workspaces: [], total: 0 })], { maxRetries: 1, onRetry })
    const result = client.workspaces.list()
    await vi.advanceTimersByTimeAsync(500)
    await expect(result).resolves.toEqual({ workspaces: [], total: 0 })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1, delayMs: 500 }))
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['invalid', '-5', 'Infinity'])('uses finite fallback backoff for Retry-After %s', async retryAfter => {
    vi.useFakeTimers()
    const onRetry = vi.fn()
    const { client } = setup([new Response('Throttled', { status: 429, headers: { 'Retry-After': retryAfter } })], { maxRetries: 1, onRetry })
    const result = client.workspaces.list()
    await vi.advanceTimersByTimeAsync(500)
    await result
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ delayMs: 500 }))
  })

  it('does not send a request for an already canceled caller', async () => {
    const { client, fetch } = setup(undefined, { maxRetries: 2 })
    const controller = new AbortController(); controller.abort()
    await expect(client.request('/api/v1/workspaces', { signal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('still enforces timeout when the caller also provides a signal', async () => {
    vi.useFakeTimers()
    const fetch = abortingFetch()
    const client = new WeavzClient({ apiKey: 'wvz_example', timeout: 25, maxRetries: 0, fetch: fetch as typeof globalThis.fetch })
    const controller = new AbortController()
    const failure = expect(client.request('/api/v1/workspaces', { signal: controller.signal })).rejects.toMatchObject({ code: 'TIMEOUT' })
    await vi.advanceTimersByTimeAsync(25)
    await failure
    expect(controller.signal.aborted).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not retry caller cancellation while a request is in flight', async () => {
    const fetch = abortingFetch()
    const client = new WeavzClient({ apiKey: 'wvz_example', maxRetries: 2, fetch: fetch as typeof globalThis.fetch })
    const controller = new AbortController()
    const failure = expect(client.request('/api/v1/workspaces', { signal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' })
    controller.abort()
    await failure
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('stops a retry delay immediately when the caller cancels', async () => {
    vi.useFakeTimers()
    const { client, fetch } = setup([new Response('Try later', { status: 503 })], { maxRetries: 2 })
    const controller = new AbortController()
    const failure = expect(client.request('/api/v1/workspaces', { signal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' })
    await vi.advanceTimersByTimeAsync(10)
    controller.abort()
    await failure
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('wraps a timeout while reading a response body', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => new Response(new ReadableStream({ start(controller) { init!.signal!.addEventListener('abort', () => controller.error(init!.signal!.reason), { once: true }) } })))
    const client = new WeavzClient({ apiKey: 'wvz_example', maxRetries: 0, timeout: 25, fetch: fetch as typeof globalThis.fetch })
    const failure = expect(client.workspaces.list()).rejects.toMatchObject({ code: 'TIMEOUT', name: 'WeavzError' })
    await vi.advanceTimersByTimeAsync(25)
    await failure
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('bounded wait helpers', () => {
  it.each(['connect', 'approvals'] as const)('bounds an in-flight %s poll by the wait deadline', async resource => {
    vi.useFakeTimers()
    const fetch = abortingFetch()
    const client = new WeavzClient({ apiKey: 'wvz_example', timeout: 310_000, fetch: fetch as typeof globalThis.fetch })
    const failure = expect(client[resource].wait('example', { timeoutMs: 25 })).rejects.toMatchObject({ code: resource === 'connect' ? 'CONNECT_TIMEOUT' : 'APPROVAL_TIMEOUT', status: 408 })
    await vi.advanceTimersByTimeAsync(25)
    await failure
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('returns a completed connect session without sleeping', async () => {
    const { client } = setup([Response.json({ status: 'COMPLETED', connectionId: 'connection' })])
    await expect(client.connect.wait('token')).resolves.toMatchObject({ status: 'COMPLETED' })
  })

  it('returns a terminal approval without sleeping', async () => {
    const { client } = setup([Response.json({ approval: { status: 'rejected' } })])
    await expect(client.approvals.wait('approval')).resolves.toMatchObject({ approval: { status: 'rejected' } })
  })

  it('validates the polling interval instead of spinning', async () => {
    const { client, fetch } = setup()
    await expect(client.connect.wait('token', { intervalMs: 0 })).rejects.toThrow(TypeError)
    expect(fetch).not.toHaveBeenCalled()
  })
})
