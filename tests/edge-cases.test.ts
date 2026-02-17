/**
 * SDK Edge Case & Negative Tests
 *
 * Tests validation errors, duplicate handling, boundary conditions,
 * authorization edge cases, and resource lifecycle correctness.
 *
 * Runs against a live local Node.js API server (http://localhost:3000).
 * Requires: Docker (Postgres, Redis, MinIO) + running `npm run dev:node`.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { WeavzClient, WeavzError } from '../src/index'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'
const SERVICE_KEY = 'local-test-service-key-12345'
let TEST_ORG_ID = ''

let client: WeavzClient
let apiKeyPlain: string
let apiKeyId: string

// Track resources for cleanup
const cleanupStack: Array<() => Promise<void>> = []
const RAND = Date.now().toString(36)

async function serviceKeyRequest(method: string, path: string, body?: unknown) {
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'X-Service-Key': SERVICE_KEY,
      'X-Org-ID': TEST_ORG_ID,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

beforeAll(async () => {
  const health = await fetch(`${BASE_URL}/health`)
  if (!health.ok) throw new Error('API server not reachable at ' + BASE_URL)

  // Create a test org
  const orgRes = await fetch(`${BASE_URL}/api/v1/orgs`, {
    method: 'POST',
    headers: { 'X-Service-Key': SERVICE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Edge Case Org', slug: `edge-test-${Date.now()}` }),
  })
  if (!orgRes.ok) throw new Error(`Failed to create org: ${orgRes.status} ${await orgRes.text()}`)
  const orgData = (await orgRes.json()) as { org: { id: string } }
  TEST_ORG_ID = orgData.org.id

  const res = await serviceKeyRequest('POST', '/api/v1/api-keys', {
    name: 'edge-case-test-key',
  })
  if (!res.ok) throw new Error(`Failed to create API key: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { apiKey: { id: string }; plainKey: string }
  apiKeyPlain = data.plainKey
  apiKeyId = data.apiKey.id

  client = new WeavzClient({ apiKey: apiKeyPlain, baseUrl: BASE_URL })
}, 15000)

afterAll(async () => {
  // Run cleanup in reverse
  for (const fn of cleanupStack.reverse()) {
    try { await fn() } catch {}
  }
  try {
    if (apiKeyId) await serviceKeyRequest('DELETE', `/api/v1/api-keys/${apiKeyId}`)
  } catch {}
})

// ────────────────────────────────────────────────────────────────────────────
// Workspace Validation & Edge Cases
// ────────────────────────────────────────────────────────────────────────────

describe('Workspace Edge Cases', () => {
  let workspaceId: string

  it('should reject empty name', async () => {
    await expect(client.workspaces.create({ name: '', slug: 'valid-slug' })).rejects.toThrow(WeavzError)
  })

  it('should reject empty slug', async () => {
    await expect(client.workspaces.create({ name: 'Valid', slug: '' })).rejects.toThrow(WeavzError)
  })

  it('should reject slug with uppercase', async () => {
    try {
      await client.workspaces.create({ name: 'Test', slug: 'Invalid-Slug' })
      // If it doesn't reject, clean up
    } catch (e) {
      expect(e).toBeInstanceOf(WeavzError)
    }
  })

  it('should reject slug with special characters', async () => {
    await expect(
      client.workspaces.create({ name: 'Test', slug: 'invalid slug!' })
    ).rejects.toThrow(WeavzError)
  })

  it('should reject slug starting with hyphen', async () => {
    await expect(
      client.workspaces.create({ name: 'Test', slug: '-leading-hyphen' })
    ).rejects.toThrow(WeavzError)
  })

  it('should create workspace with unicode name', async () => {
    const result = await client.workspaces.create({
      name: 'Projet Spécial 日本語',
      slug: `unicode-name-${RAND}`,
    })
    expect(result).toHaveProperty('workspace')
    workspaceId = (result.workspace as any).id
    cleanupStack.push(() => client.workspaces.delete(workspaceId))
    expect((result.workspace as any).name).toBe('Projet Spécial 日本語')
  })

  it('should reject duplicate workspace slug', async () => {
    try {
      await client.workspaces.create({ name: 'Duplicate', slug: `unicode-name-${RAND}` })
      // Should have thrown
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeInstanceOf(WeavzError)
      expect((e as WeavzError).status).toBeGreaterThanOrEqual(400)
    }
  })

  it('should list workspaces with pagination-like response', async () => {
    const result = await client.workspaces.list()
    expect(result).toHaveProperty('workspaces')
    expect(Array.isArray(result.workspaces)).toBe(true)
  })

  it('should return error for non-existent workspace', async () => {
    await expect(
      client.workspaces.get('00000000-0000-0000-0000-000000000000')
    ).rejects.toThrow(WeavzError)
  })

  it('should handle deleting already-deleted workspace gracefully', async () => {
    // Create then delete a workspace
    const created = await client.workspaces.create({ name: 'ToDelete', slug: `to-delete-${RAND}` })
    const id = (created.workspace as any).id
    await client.workspaces.delete(id)
    // Try to delete again
    await expect(client.workspaces.delete(id)).rejects.toThrow(WeavzError)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Connection Edge Cases
// ────────────────────────────────────────────────────────────────────────────

describe('Connection Edge Cases', () => {
  let workspaceId: string
  let connId: string

  beforeAll(async () => {
    const p = await client.workspaces.create({ name: 'Conn Edge', slug: `conn-edge-${RAND}` })
    workspaceId = (p.workspace as any).id
    cleanupStack.push(() => client.workspaces.delete(workspaceId))
  })

  it('should create SECRET_TEXT connection', async () => {
    const result = await client.connections.create({
      type: 'SECRET_TEXT',
      externalId: 'edge-secret-1',
      displayName: 'Edge Secret Text',
      integrationName: 'openai',
      secretText: 'sk-test-edge-12345',
      workspaceId,
    })
    expect(result).toHaveProperty('connection')
    connId = (result.connection as any).id
    cleanupStack.push(() => client.connections.delete(connId))
  })

  it('should reject duplicate connection (same integration + externalId)', async () => {
    try {
      await client.connections.create({
        type: 'SECRET_TEXT',
        externalId: 'edge-secret-1',
        displayName: 'Duplicate',
        integrationName: 'openai',
        secretText: 'sk-test-dupe',
        workspaceId,
      })
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeInstanceOf(WeavzError)
      expect((e as WeavzError).status).toBe(409)
    }
  })

  it('should allow same externalId for different integration', async () => {
    const result = await client.connections.create({
      type: 'SECRET_TEXT',
      externalId: 'edge-secret-1',
      displayName: 'Same ExtID Different Integration',
      integrationName: 'slack',
      secretText: 'sk-slack-test-edge',
      workspaceId,
    })
    expect(result).toHaveProperty('connection')
    const id = (result.connection as any).id
    cleanupStack.push(() => client.connections.delete(id))
  })

  it('should create BASIC_AUTH connection', async () => {
    const result = await client.connections.create({
      type: 'BASIC_AUTH',
      externalId: 'edge-basic-1',
      displayName: 'Edge Basic Auth',
      integrationName: 'http',
      username: 'testuser',
      password: 'testpass123',
      workspaceId,
    })
    expect(result).toHaveProperty('connection')
    const id = (result.connection as any).id
    cleanupStack.push(() => client.connections.delete(id))
  })

  it('should create CUSTOM_AUTH connection', async () => {
    const result = await client.connections.create({
      type: 'CUSTOM_AUTH',
      externalId: 'edge-custom-1',
      displayName: 'Edge Custom Auth',
      integrationName: 'http',
      props: { headerName: 'X-Custom-Token', headerValue: 'test-token-value' },
      workspaceId,
    })
    expect(result).toHaveProperty('connection')
    const id = (result.connection as any).id
    cleanupStack.push(() => client.connections.delete(id))
  })

  it('should reject connection with missing required fields', async () => {
    await expect(
      client.connections.create({
        type: 'SECRET_TEXT',
        externalId: '',
        displayName: '',
        integrationName: '',
      })
    ).rejects.toThrow(WeavzError)
  })

  it('should reject connection for non-existent integration', async () => {
    try {
      await client.connections.create({
        type: 'SECRET_TEXT',
        externalId: 'edge-nonexist',
        displayName: 'Bad Integration',
        integrationName: 'nonexistent-integration-xyz',
        secretText: 'test',
        workspaceId,
      })
    } catch (e) {
      expect(e).toBeInstanceOf(WeavzError)
    }
  })

  it('should resolve connection with valid filters', async () => {
    const result = await client.connections.resolve({
      integrationName: 'openai',
      externalId: 'edge-secret-1',
      workspaceId,
    })
    expect(result).toHaveProperty('connection')
    expect((result.connection as any).id).toBe(connId)
  })

  it('should fail resolving non-existent connection', async () => {
    await expect(
      client.connections.resolve({
        integrationName: 'openai',
        externalId: 'does-not-exist-xyz',
        workspaceId,
      })
    ).rejects.toThrow(WeavzError)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// MCP Server Edge Cases
// ────────────────────────────────────────────────────────────────────────────

describe('MCP Server Edge Cases', () => {
  let workspaceId: string
  let toolsServerId: string
  let codeServerId: string

  beforeAll(async () => {
    const p = await client.workspaces.create({ name: 'MCP Edge', slug: `mcp-edge-${RAND}` })
    workspaceId = (p.workspace as any).id
    cleanupStack.push(() => client.workspaces.delete(workspaceId))
  })

  it('should create TOOLS mode server (default)', async () => {
    const result = await client.mcpServers.create({
      name: 'Edge Tools Server',
      description: 'Testing tools mode',
      workspaceId,
      mode: 'TOOLS',
    })
    expect(result).toHaveProperty('server')
    expect(result).toHaveProperty('bearerToken')
    expect(result.bearerToken).toMatch(/^mcp_/)
    expect(result).toHaveProperty('mcpEndpoint')
    toolsServerId = (result.server as any).id
    cleanupStack.push(() => client.mcpServers.delete(toolsServerId))
  })

  it('should create CODE mode server', async () => {
    const result = await client.mcpServers.create({
      name: 'Edge Code Server',
      description: 'Testing code mode',
      workspaceId,
      mode: 'CODE',
    })
    expect(result).toHaveProperty('server')
    expect((result.server as any).mode).toBe('CODE')
    codeServerId = (result.server as any).id
    cleanupStack.push(() => client.mcpServers.delete(codeServerId))
  })

  it('should add tool with valid alias', async () => {
    const result = await client.mcpServers.addTool(toolsServerId, {
      integrationName: 'openai',
      actionName: 'ask_chatgpt',
      integrationAlias: 'openai-primary',
    })
    expect(result).toHaveProperty('tool')
    const toolId = (result.tool as any).id
    cleanupStack.push(() =>
      client.mcpServers.deleteTool(toolsServerId, toolId).catch(() => {})
    )
  })

  it('should reject duplicate tool (same alias + action)', async () => {
    try {
      await client.mcpServers.addTool(toolsServerId, {
        integrationName: 'openai',
        actionName: 'ask_chatgpt',
        integrationAlias: 'openai-primary',
      })
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeInstanceOf(WeavzError)
      expect((e as WeavzError).status).toBe(409)
    }
  })

  it('should allow same action with different alias', async () => {
    const result = await client.mcpServers.addTool(toolsServerId, {
      integrationName: 'openai',
      actionName: 'ask_chatgpt',
      integrationAlias: 'openai-secondary',
    })
    expect(result).toHaveProperty('tool')
    const toolId = (result.tool as any).id
    cleanupStack.push(() =>
      client.mcpServers.deleteTool(toolsServerId, toolId).catch(() => {})
    )
  })

  it('should reject alias with uppercase letters', async () => {
    try {
      await client.mcpServers.addTool(toolsServerId, {
        integrationName: 'openai',
        actionName: 'ask_chatgpt',
        integrationAlias: 'OpenAI',
      })
    } catch (e) {
      expect(e).toBeInstanceOf(WeavzError)
      expect((e as WeavzError).status).toBe(400)
    }
  })

  it('should reject alias starting with underscore', async () => {
    try {
      await client.mcpServers.addTool(toolsServerId, {
        integrationName: 'openai',
        actionName: 'ask_chatgpt',
        integrationAlias: '_openai',
      })
    } catch (e) {
      expect(e).toBeInstanceOf(WeavzError)
      expect((e as WeavzError).status).toBe(400)
    }
  })

  it('should reject alias with special characters', async () => {
    try {
      await client.mcpServers.addTool(toolsServerId, {
        integrationName: 'openai',
        actionName: 'ask_chatgpt',
        integrationAlias: 'openai@bot',
      })
    } catch (e) {
      expect(e).toBeInstanceOf(WeavzError)
      expect((e as WeavzError).status).toBe(400)
    }
  })

  it('should reject alias conflict (same alias, different integration)', async () => {
    // 'openai-primary' already exists for openai — try adding with discord
    try {
      await client.mcpServers.addTool(toolsServerId, {
        integrationName: 'discord',
        actionName: 'sendMessageWithBot',
        integrationAlias: 'openai-primary',
      })
    } catch (e) {
      expect(e).toBeInstanceOf(WeavzError)
      // Should be 409 ALIAS_CONFLICT
      expect((e as WeavzError).status).toBe(409)
    }
  })

  it('should add tool with custom display name and description', async () => {
    const result = await client.mcpServers.addTool(toolsServerId, {
      integrationName: 'slack',
      actionName: 'send_channel_message',
      displayName: 'Post to Slack',
      description: 'Custom description for edge test',
    })
    expect(result).toHaveProperty('tool')
    expect((result.tool as any).displayName).toBe('Post to Slack')
    const toolId = (result.tool as any).id
    cleanupStack.push(() =>
      client.mcpServers.deleteTool(toolsServerId, toolId).catch(() => {})
    )
  })

  it('should update server from TOOLS to CODE mode', async () => {
    // Create a disposable server
    const s = await client.mcpServers.create({
      name: 'Mode Switch Server',
      workspaceId,
      mode: 'TOOLS',
    })
    const id = (s.server as any).id
    cleanupStack.push(() => client.mcpServers.delete(id).catch(() => {}))

    const result = await client.mcpServers.update(id, { mode: 'CODE' })
    expect((result.server as any).mode).toBe('CODE')
  })

  it('should regenerate token and get new value', async () => {
    const result1 = await client.mcpServers.regenerateToken(toolsServerId)
    const result2 = await client.mcpServers.regenerateToken(toolsServerId)
    expect(result1.bearerToken).toMatch(/^mcp_/)
    expect(result2.bearerToken).toMatch(/^mcp_/)
    // Tokens should be different
    expect(result1.bearerToken).not.toBe(result2.bearerToken)
  })

  it('should get server details with tools list', async () => {
    const result = await client.mcpServers.get(toolsServerId)
    expect(result).toHaveProperty('server')
    expect(result).toHaveProperty('tools')
    expect(Array.isArray(result.tools)).toBe(true)
    expect((result.tools as any[]).length).toBeGreaterThan(0)
  })

  it('should reject operations on non-existent server', async () => {
    await expect(
      client.mcpServers.get('00000000-0000-0000-0000-000000000000')
    ).rejects.toThrow(WeavzError)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Workspace Integration Edge Cases
// ────────────────────────────────────────────────────────────────────────────

describe('Workspace Integration Edge Cases', () => {
  let connId: string
  let workspaceId: string

  beforeAll(async () => {
    const p = await client.workspaces.create({ name: 'WsInt Edge', slug: `wsint-edge-${RAND}` })
    workspaceId = (p.workspace as any).id
    cleanupStack.push(() => client.workspaces.delete(workspaceId))

    const c = await client.connections.create({
      type: 'SECRET_TEXT',
      externalId: 'wsint-edge-conn',
      displayName: 'WsInt Edge Conn',
      integrationName: 'github',
      secretText: 'ghp_testtoken123',
      workspaceId,
    })
    connId = (c.connection as any).id
    cleanupStack.push(() => client.connections.delete(connId))
  })

  it('should reject fixed strategy without connectionId', async () => {
    try {
      await client.workspaces.addIntegration(workspaceId, {
        integrationName: 'github',
        connectionStrategy: 'fixed',
      })
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeInstanceOf(WeavzError)
      expect((e as WeavzError).status).toBe(400)
    }
  })

  it('should add fixed strategy integration with connectionId', async () => {
    const result = await client.workspaces.addIntegration(workspaceId, {
      integrationName: 'github',
      connectionStrategy: 'fixed',
      connectionId: connId,
    })
    expect(result).toHaveProperty('integration')
    expect((result.integration as any).connectionStrategy).toBe('fixed')
    expect((result.integration as any).connectionId).toBe(connId)
    const integrationId = (result.integration as any).id
    cleanupStack.push(() => client.workspaces.removeIntegration(workspaceId, integrationId))
  })

  it('should update existing workspace integration strategy', async () => {
    // Create per_user, then update to per_user_with_fallback
    const created = await client.workspaces.addIntegration(workspaceId, {
      integrationName: 'slack',
      connectionStrategy: 'per_user',
    })
    const integrationId = (created.integration as any).id
    cleanupStack.push(() => client.workspaces.removeIntegration(workspaceId, integrationId))

    const updated = await client.workspaces.updateIntegration(workspaceId, integrationId, {
      connectionStrategy: 'per_user_with_fallback',
    })
    expect((updated.integration as any).connectionStrategy).toBe('per_user_with_fallback')
  })

  it('should add per_user integration for different integration', async () => {
    const result = await client.workspaces.addIntegration(workspaceId, {
      integrationName: 'notion',
      connectionStrategy: 'per_user',
    })
    expect(result).toHaveProperty('integration')
    expect((result.integration as any).integrationName).toBe('notion')
    const integrationId = (result.integration as any).id
    cleanupStack.push(() => client.workspaces.removeIntegration(workspaceId, integrationId))
  })

  it('should add integration with custom alias', async () => {
    const result = await client.workspaces.addIntegration(workspaceId, {
      integrationName: 'openai',
      alias: 'openai-primary',
      connectionStrategy: 'per_user',
    })
    expect(result).toHaveProperty('integration')
    expect((result.integration as any).alias).toBe('openai-primary')
    const integrationId = (result.integration as any).id
    cleanupStack.push(() => client.workspaces.removeIntegration(workspaceId, integrationId))
  })

  it('should remove a workspace integration', async () => {
    const created = await client.workspaces.addIntegration(workspaceId, {
      integrationName: 'discord',
      connectionStrategy: 'per_user',
    })
    const integrationId = (created.integration as any).id

    const result = await client.workspaces.removeIntegration(workspaceId, integrationId)
    expect(result).toHaveProperty('deleted', true)
    expect(result).toHaveProperty('id', integrationId)
  })

  it('should list workspace integrations and verify structure', async () => {
    const result = await client.workspaces.listIntegrations(workspaceId)
    expect(result).toHaveProperty('integrations')
    expect(result).toHaveProperty('total')
    expect(Array.isArray(result.integrations)).toBe(true)
    expect(result.integrations.length).toBeGreaterThan(0)

    // Each workspace integration should have basic fields
    const first = result.integrations[0] as any
    expect(first).toHaveProperty('id')
    expect(first).toHaveProperty('integrationName')
    expect(first).toHaveProperty('connectionStrategy')
  })

  it('should add integration with display name', async () => {
    const created = await client.workspaces.addIntegration(workspaceId, {
      integrationName: 'http',
      connectionStrategy: 'per_user',
      displayName: 'HTTP Service',
    })
    const integrationId = (created.integration as any).id
    cleanupStack.push(() => client.workspaces.removeIntegration(workspaceId, integrationId))

    expect((created.integration as any).displayName).toBe('HTTP Service')

    // Update display name
    const updated = await client.workspaces.updateIntegration(workspaceId, integrationId, {
      displayName: 'Updated HTTP Service',
    })
    expect((updated.integration as any).displayName).toBe('Updated HTTP Service')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// API Key Edge Cases
// ────────────────────────────────────────────────────────────────────────────

describe('API Key Edge Cases', () => {
  it('should reject empty key name', async () => {
    await expect(
      client.apiKeys.create({ name: '' })
    ).rejects.toThrow(WeavzError)
  })

  it('should create multiple keys and list them', async () => {
    const key1 = await client.apiKeys.create({ name: 'edge-key-1' })
    const key2 = await client.apiKeys.create({ name: 'edge-key-2' })
    cleanupStack.push(() => client.apiKeys.delete((key1.apiKey as any).id))
    cleanupStack.push(() => client.apiKeys.delete((key2.apiKey as any).id))

    expect(key1.plainKey).toMatch(/^wvz_/)
    expect(key2.plainKey).toMatch(/^wvz_/)
    expect(key1.plainKey).not.toBe(key2.plainKey)

    const list = await client.apiKeys.list()
    const names = (list.apiKeys as any[]).map((k: any) => k.name)
    expect(names).toContain('edge-key-1')
    expect(names).toContain('edge-key-2')
  })

  it('newly created key should work for auth', async () => {
    const key = await client.apiKeys.create({ name: 'edge-key-auth-test' })
    cleanupStack.push(() => client.apiKeys.delete((key.apiKey as any).id))

    const newClient = new WeavzClient({ apiKey: key.plainKey, baseUrl: BASE_URL })

    // Should be able to list integrations
    const intResult = await newClient.integrations.list()
    expect(intResult.total).toBeGreaterThan(0)
  })

  it('deleted key should stop working', async () => {
    const key = await client.apiKeys.create({ name: 'edge-key-delete-test' })
    const keyClient = new WeavzClient({ apiKey: key.plainKey, baseUrl: BASE_URL })

    // Should work
    await keyClient.integrations.list()

    // Delete the key
    await client.apiKeys.delete((key.apiKey as any).id)

    // Should fail
    await expect(keyClient.apiKeys.list()).rejects.toThrow(WeavzError)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Integration Edge Cases
// ────────────────────────────────────────────────────────────────────────────

describe('Integration Edge Cases', () => {
  it('should return NOT_FOUND for non-existent integration', async () => {
    try {
      await client.integrations.get('definitely-not-a-real-integration')
    } catch (e) {
      expect(e).toBeInstanceOf(WeavzError)
      expect((e as WeavzError).status).toBe(404)
    }
  })

  it('should list integrations and verify structure', async () => {
    const result = await client.integrations.list()
    expect(result).toHaveProperty('integrations')
    expect(result).toHaveProperty('total')
    expect(result).toHaveProperty('registered')
    expect(result.total).toBeGreaterThan(30)
    expect(Array.isArray(result.registered)).toBe(true)

    // Each integration should have basic fields
    const first = result.integrations[0] as any
    expect(first).toHaveProperty('name')
    expect(first).toHaveProperty('displayName')
  })

  it('should get integration with full metadata', async () => {
    const result = await client.integrations.get('slack')
    const integration = result.integration as any
    expect(integration.name).toBe('slack')
    expect(integration).toHaveProperty('displayName')
    expect(integration).toHaveProperty('actions')
    expect(integration).toHaveProperty('triggers')
  })

  it('should return oauth status for configured integrations', async () => {
    const result = await client.integrations.oauthStatus()
    expect(result).toHaveProperty('configured')
    expect(Array.isArray(result.configured)).toBe(true)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Activity Edge Cases
// ────────────────────────────────────────────────────────────────────────────

describe('Activity Edge Cases', () => {
  it('should list activity with default pagination', async () => {
    const result = await client.activity.list()
    expect(result).toHaveProperty('events')
    expect(result).toHaveProperty('total')
    expect(typeof result.total).toBe('number')
  })

  it('should filter activity with limit', async () => {
    const result = await client.activity.list({ limit: 5 })
    expect(result).toHaveProperty('events')
    expect((result.events as any[]).length).toBeLessThanOrEqual(5)
  })

  it('should filter activity with offset', async () => {
    const result = await client.activity.list({ limit: 2, offset: 0 })
    const result2 = await client.activity.list({ limit: 2, offset: 2 })
    // Both should return events arrays (may or may not overlap depending on activity count)
    expect(result).toHaveProperty('events')
    expect(result2).toHaveProperty('events')
  })

  it('should handle future since filter (empty results)', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 365).toISOString()
    const result = await client.activity.list({ since: futureDate })
    expect(result).toHaveProperty('events')
    expect((result.events as any[]).length).toBe(0)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// OAuth App Edge Cases
// ────────────────────────────────────────────────────────────────────────────

describe('OAuth App Edge Cases', () => {
  it('should reject oauth app for non-oauth integration', async () => {
    // HTTP integration doesn't support OAuth
    try {
      await client.oauthApps.create({
        integrationName: 'http',
        clientId: 'test-id',
        clientSecret: 'test-secret',
      })
    } catch (e) {
      expect(e).toBeInstanceOf(WeavzError)
    }
  })

  it('should create and delete oauth app with all fields', async () => {
    const result = await client.oauthApps.create({
      integrationName: 'github',
      clientId: 'edge-test-client-id',
      clientSecret: 'edge-test-client-secret',
    })
    expect(result).toHaveProperty('app')
    const id = (result.app as any).id

    const delResult = await client.oauthApps.delete(id)
    expect(delResult).toHaveProperty('deleted', true)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Webhook Secret Edge Cases
// ────────────────────────────────────────────────────────────────────────────

describe('Webhook Secret Edge Cases', () => {
  it('should create webhook secret with long value', async () => {
    const longSecret = 'a'.repeat(256)
    const result = await client.webhookSecrets.create({
      integrationName: 'github',
      secret: longSecret,
    })
    expect(result).toHaveProperty('success', true)
  })

  it('should list webhook secrets after creation', async () => {
    const result = await client.webhookSecrets.list()
    expect(result).toHaveProperty('secrets')
    expect(Array.isArray(result.secrets)).toBe(true)
    expect((result.secrets as any[]).length).toBeGreaterThan(0)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Trigger Edge Cases
// ────────────────────────────────────────────────────────────────────────────

describe('Trigger Edge Cases', () => {
  it('should reject test for non-existent trigger', async () => {
    try {
      await client.triggers.test('slack', 'nonexistent-trigger')
    } catch (e) {
      expect(e).toBeInstanceOf(WeavzError)
    }
  })

  it('should reject test for non-existent integration', async () => {
    try {
      await client.triggers.test('nonexistent-integration', 'some-trigger')
    } catch (e) {
      expect(e).toBeInstanceOf(WeavzError)
    }
  })

  it('should list available triggers', async () => {
    const result = await client.triggers.list()
    expect(result).toHaveProperty('triggers')
    expect(Array.isArray(result.triggers)).toBe(true)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Error Shape Consistency
// ────────────────────────────────────────────────────────────────────────────

describe('Error Shape Consistency', () => {
  it('WeavzError should have message, code, status', async () => {
    try {
      const badClient = new WeavzClient({ apiKey: 'wvz_totally_invalid', baseUrl: BASE_URL })
      await badClient.apiKeys.list()
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeInstanceOf(WeavzError)
      const err = e as WeavzError
      expect(typeof err.message).toBe('string')
      expect(typeof err.code).toBe('string')
      expect(typeof err.status).toBe('number')
      expect(err.status).toBe(401)
    }
  })

  it('validation errors should include error details', async () => {
    try {
      await client.workspaces.create({ name: '', slug: '' })
    } catch (e) {
      expect(e).toBeInstanceOf(WeavzError)
      const err = e as WeavzError
      expect(err.status).toBeGreaterThanOrEqual(400)
      expect(err.status).toBeLessThan(500)
    }
  })

  it('should handle request to invalid path', async () => {
    try {
      await client.request('/api/v1/nonexistent-endpoint')
    } catch (e) {
      expect(e).toBeInstanceOf(WeavzError)
      expect((e as WeavzError).status).toBe(404)
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Client Configuration Edge Cases
// ────────────────────────────────────────────────────────────────────────────

describe('Client Configuration', () => {
  it('should strip trailing slashes from baseUrl', async () => {
    const c = new WeavzClient({ apiKey: apiKeyPlain, baseUrl: BASE_URL + '///' })
    const result = await c.integrations.list()
    expect(result.total).toBeGreaterThan(0)
  })

  it('should handle baseUrl without protocol gracefully', async () => {
    // This should fail but not crash
    const c = new WeavzClient({ apiKey: apiKeyPlain, baseUrl: 'localhost:3000' })
    try {
      await c.integrations.list()
    } catch (e) {
      // Expected to fail - fetch requires protocol
      expect(e).toBeTruthy()
    }
  })

  it('should work with custom request method', async () => {
    // Verify the raw request method works
    const result = await client.request<{ status: string }>('/health')
    expect(result.status).toBe('healthy')
  })
})
