import { describe, expect, it, vi } from 'vitest'
import { WeavzClient, type ComputerSessionAccess } from '../../src/index'

const workspaceId = '550e8400-e29b-41d4-a716-446655440001'
const sessionId = '550e8400-e29b-41d4-a716-446655440002'
const access: ComputerSessionAccess = { sessionId, role: 'control', viewerUrl: `https://api.example.test/api/v1/computer-sessions/${sessionId}/viewer#token=fixture-only`, expiresAt: '2030-01-01T00:00:00.000Z', frameOrigin: 'https://app.example.test' }
function fixture(body: unknown) {
  const fetch = vi.fn(async () => Response.json(body))
  return { fetch, client: new WeavzClient({ apiKey: 'wvz_fixture', baseUrl: 'https://api.example.test', maxRetries: 0, fetch: fetch as typeof globalThis.fetch }) }
}

describe('human computer access customer contract', () => {
  it('sends external identity, role and embedding origin to the access endpoint only', async () => {
    const { client, fetch } = fixture(access)
    const result = await client.computerSessions.createAccess(sessionId, { workspaceId, endUserId: 'customer/alice@example.test', role: 'control', ttlSeconds: 120, frameOrigin: 'https://app.example.test:443' })
    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`https://api.example.test/api/v1/computer-sessions/${sessionId}/access`)
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer wvz_fixture')
    expect(JSON.parse(init.body as string)).toEqual({ workspaceId, endUserId: 'customer/alice@example.test', role: 'control', ttlSeconds: 120, frameOrigin: 'https://app.example.test:443' })
    expect(result).toEqual(access)
    expect(result.viewerUrl).toContain('#token=fixture-only')
    expect('viewer' in client.computerSessions).toBe(false)
    expect('stream' in client.computerSessions).toBe(false)
    expect('control' in client.computerSessions).toBe(false)
  })
  it('omits unspecified link options and encodes the session identifier as one path segment', async () => {
    const { client, fetch } = fixture(access)
    await client.computerSessions.createAccess('session/a?b#c', { workspaceId, endUserId: 'external-user', role: 'watch' })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(new URL(url).pathname).toBe('/api/v1/computer-sessions/session%2Fa%3Fb%23c/access')
    expect(JSON.parse(init.body as string)).toEqual({ workspaceId, endUserId: 'external-user', role: 'watch' })
  })
})

describe('approval client contract', () => {
  it('supports history and opaque cursor pagination without dropping nextCursor', async () => {
    const { client, fetch } = fixture({ approvals: [], total: 0, nextCursor: 'next-page' })
    const result = await client.approvals.list({ workspaceId, status: 'history', cursor: 'opaque+cursor/=', limit: 2 })
    const url = new URL(fetch.mock.calls[0][0] as unknown as string)
    expect(url.searchParams.get('status')).toBe('history')
    expect(url.searchParams.get('cursor')).toBe('opaque+cursor/=')
    expect(url.searchParams.get('workspaceId')).toBe(workspaceId)
    expect(result.nextCursor).toBe('next-page')
  })
  it('keeps nullable workspace PATCH sparse and exposes current review authority', async () => {
    const { client, fetch } = fixture({ policy: { id: 'policy' } })
    await client.approvalPolicies.update('policy', { workspaceId: null })
    const init = fetch.mock.calls[0][1] as unknown as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({ workspaceId: null })
    const detail = fixture({ approval: { id: 'approval', reviewAccess: { canDecide: false, code: 'APPROVAL_DECISION_SCOPE_REQUIRED', reason: 'Decision permission is required.' } } })
    expect((await detail.client.approvals.get('approval')).approval.reviewAccess?.canDecide).toBe(false)
  })
})

describe('MCP Workspace customer contract', () => {
  it('creates by name and configures the returned endpoint without creating another server', async () => {
    const serverId = '660e8400-e29b-41d4-a716-446655440002'
    const mcpEndpoint = `https://api.example.test/mcp/srv_${serverId}`
    const workspace = { id: workspaceId, name: 'Support', mcpServer: { id: serverId, mcpEndpoint } }
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      if (init.method === 'PATCH') return Response.json({ server: { id: serverId, mcpEndpoint, mode: 'TOOLS' } })
      return Response.json({ workspace })
    })
    const client = new WeavzClient({ apiKey: 'wvz_fixture', baseUrl: 'https://api.example.test', maxRetries: 0, fetch: fetch as typeof globalThis.fetch })
    expect(client.mcpWorkspaces).toBe(client.workspaces)
    await client.mcpWorkspaces.create({ name: 'Support' })
    const result = await client.mcpWorkspaces.configureMcp(workspaceId, { mode: 'TOOLS', allowWorkspaceMembers: false })
    expect(result.mcpEndpoint).toBe(mcpEndpoint)
    expect(fetch.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ['https://api.example.test/api/v1/workspaces', 'POST'],
      [`https://api.example.test/api/v1/workspaces/${workspaceId}`, 'GET'],
      [`https://api.example.test/api/v1/mcp/servers/${serverId}`, 'PATCH'],
    ])
    expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({ name: 'Support' })
    expect(JSON.parse(fetch.mock.calls[2][1].body as string)).toEqual({ mode: 'TOOLS', allowWorkspaceMembers: false })
  })
})


describe('MCP Workspace private token contract', () => {
  it.each(['oauth', 'bearer'] as const)('issues %s access by workspace and external user alone', async authMethod => {
    const response = { accessToken: 'fixture-only', mcpEndpoint: 'https://api.example.test/mcp/srv_fixture', token: { endUserId: 'customer/alice', authMethod } }
    const { client, fetch } = fixture(response)
    expect(await client.mcpWorkspaces.createAccessToken('workspace/a?b', { endUserId: 'customer/alice', scopes: ['mcp:tools'], expiresIn: 600 })).toEqual(response)
    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.example.test/api/v1/workspaces/workspace%2Fa%3Fb/access-tokens')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ endUserId: 'customer/alice', scopes: ['mcp:tools'], expiresIn: 600 })
  })
})
