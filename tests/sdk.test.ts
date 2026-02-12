/**
 * SDK Integration Tests
 *
 * Runs against a live local Node.js API server (http://localhost:3000).
 * Requires: Docker (Postgres, Redis, MinIO) + running `npm run dev:node`.
 *
 * Bootstrap: creates a user via BetterAuth sign-up, creates an org,
 * then creates an API key to use for all subsequent SDK tests.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { WeavzClient, WeavzError } from '../src/index'

const BASE_URL = 'http://localhost:3000'
const SERVICE_KEY = 'local-test-service-key-12345'
const TEST_ORG_ID = '6555c8f1-c057-4c02-9980-1ef723c23855'

let client: WeavzClient
let apiKeyPlain: string
let apiKeyId: string

// Track resources for cleanup
let createdProjectId: string
let createdConnectionId: string
let createdMcpServerId: string
let createdProjectIntegrationId: string

async function serviceKeyRequest(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {
    'X-Service-Key': SERVICE_KEY,
    'X-Org-ID': TEST_ORG_ID,
    'Content-Type': 'application/json',
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  return res
}

// ────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Verify server is reachable
  const health = await fetch(`${BASE_URL}/health`)
  if (!health.ok) throw new Error('API server not reachable at ' + BASE_URL)

  // Create an API key using the service key
  const res = await serviceKeyRequest('POST', '/api/v1/api-keys', {
    name: 'sdk-test-key',
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to create API key: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { apiKey: { id: string }; plainKey: string }
  apiKeyPlain = data.plainKey
  apiKeyId = data.apiKey.id

  // Initialize SDK client
  client = new WeavzClient({ apiKey: apiKeyPlain, baseUrl: BASE_URL })
}, 15000)

afterAll(async () => {
  // Cleanup in reverse order
  try {
    if (createdProjectIntegrationId) await client.projects.removeIntegration(createdProjectId, createdProjectIntegrationId)
  } catch {}
  try {
    if (createdMcpServerId) await client.mcpServers.delete(createdMcpServerId)
  } catch {}
  try {
    if (createdConnectionId) await client.connections.delete(createdConnectionId)
  } catch {}
  try {
    if (createdProjectId) await client.projects.delete(createdProjectId)
  } catch {}
  try {
    if (apiKeyId) {
      // Delete the test API key using service key (can't delete own key with itself)
      await serviceKeyRequest('DELETE', `/api/v1/api-keys/${apiKeyId}`)
    }
  } catch {}
})

// ────────────────────────────────────────────────────────────────────────────
// API Keys
// ────────────────────────────────────────────────────────────────────────────

describe('API Keys', () => {
  it('should list API keys', async () => {
    const result = await client.apiKeys.list()
    expect(result).toHaveProperty('apiKeys')
    expect(Array.isArray(result.apiKeys)).toBe(true)
    expect(result.apiKeys.length).toBeGreaterThan(0)
  })

  it('should create and delete an API key', async () => {
    const result = await client.apiKeys.create({ name: 'temp-test-key' })
    expect(result).toHaveProperty('plainKey')
    expect(result.plainKey).toMatch(/^wvz_/)
    expect(result).toHaveProperty('apiKey')
    expect((result.apiKey as any).name).toBe('temp-test-key')

    // Delete it
    const delResult = await client.apiKeys.delete((result.apiKey as any).id)
    expect(delResult).toHaveProperty('deleted', true)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Projects
// ────────────────────────────────────────────────────────────────────────────

describe('Projects', () => {
  it('should create a project', async () => {
    const result = await client.projects.create({
      name: 'SDK Test Project',
      slug: 'sdk-test-project',
    })
    expect(result).toHaveProperty('project')
    expect((result.project as any).name).toBe('SDK Test Project')
    expect((result.project as any).slug).toBe('sdk-test-project')
    createdProjectId = (result.project as any).id
  })

  it('should list projects', async () => {
    const result = await client.projects.list()
    expect(result).toHaveProperty('projects')
    expect(result.projects.length).toBeGreaterThan(0)
  })

  it('should get a specific project', async () => {
    const result = await client.projects.get(createdProjectId)
    expect(result).toHaveProperty('project')
    expect((result.project as any).id).toBe(createdProjectId)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Integrations
// ────────────────────────────────────────────────────────────────────────────

describe('Integrations', () => {
  it('should list integrations', async () => {
    const result = await client.integrations.list()
    expect(result).toHaveProperty('integrations')
    expect(result.total).toBeGreaterThan(0)
    expect(result.integrations.length).toBeGreaterThan(30)
  })

  it('should get a specific integration', async () => {
    const result = await client.integrations.get('slack')
    expect(result).toHaveProperty('integration')
    expect((result.integration as any).name).toBe('slack')
  })

  it('should check OAuth status', async () => {
    const result = await client.integrations.oauthStatus()
    expect(result).toHaveProperty('configured')
    expect(Array.isArray(result.configured)).toBe(true)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Connections
// ────────────────────────────────────────────────────────────────────────────

describe('Connections', () => {
  it('should create a SECRET_TEXT connection', async () => {
    const result = await client.connections.create({
      type: 'SECRET_TEXT',
      externalId: 'sdk-test-ext-id',
      displayName: 'SDK Test Connection',
      integrationName: 'openai',
      secretText: 'sk-test-fake-key-12345',
      projectId: createdProjectId,
    })
    expect(result).toHaveProperty('connection')
    expect((result.connection as any).displayName).toBe('SDK Test Connection')
    createdConnectionId = (result.connection as any).id
  })

  it('should list connections', async () => {
    const result = await client.connections.list()
    expect(result).toHaveProperty('connections')
    expect((result as any).connections.length).toBeGreaterThan(0)
  })

  it('should resolve a connection', async () => {
    const result = await client.connections.resolve({
      integrationName: 'openai',
      externalId: 'sdk-test-ext-id',
      projectId: createdProjectId,
    })
    expect(result).toHaveProperty('connection')
    expect((result.connection as any).id).toBe(createdConnectionId)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Project Integrations
// ────────────────────────────────────────────────────────────────────────────

describe('Project Integrations', () => {
  it('should add an integration to a project', async () => {
    const result = await client.projects.addIntegration(createdProjectId, {
      integrationName: 'slack',
      connectionStrategy: 'per_user',
    })
    expect(result).toHaveProperty('integration')
    expect((result.integration as any).integrationName).toBe('slack')
    expect((result.integration as any).connectionStrategy).toBe('per_user')
    createdProjectIntegrationId = (result.integration as any).id
  })

  it('should list project integrations', async () => {
    const result = await client.projects.listIntegrations(createdProjectId)
    expect(result).toHaveProperty('integrations')
    expect(result).toHaveProperty('total')
    expect(result.integrations.length).toBeGreaterThan(0)
  })

  it('should update a project integration', async () => {
    const result = await client.projects.updateIntegration(createdProjectId, createdProjectIntegrationId, {
      connectionStrategy: 'per_user_with_fallback',
    })
    expect(result).toHaveProperty('integration')
    expect((result.integration as any).connectionStrategy).toBe('per_user_with_fallback')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// MCP Servers
// ────────────────────────────────────────────────────────────────────────────

describe('MCP Servers', () => {
  let toolId: string

  it('should create an MCP server', async () => {
    const result = await client.mcpServers.create({
      name: 'SDK Test Server',
      description: 'Integration test server',
      projectId: createdProjectId,
      mode: 'TOOLS',
    })
    expect(result).toHaveProperty('server')
    expect(result).toHaveProperty('bearerToken')
    expect(result.bearerToken).toMatch(/^mcp_/)
    expect(result).toHaveProperty('mcpEndpoint')
    createdMcpServerId = (result.server as any).id
  })

  it('should list MCP servers', async () => {
    const result = await client.mcpServers.list()
    expect(result).toHaveProperty('servers')
    expect((result as any).servers.length).toBeGreaterThan(0)
  })

  it('should get a specific server', async () => {
    const result = await client.mcpServers.get(createdMcpServerId)
    expect(result).toHaveProperty('server')
    expect((result.server as any).name).toBe('SDK Test Server')
  })

  it('should add a tool to the server', async () => {
    const result = await client.mcpServers.addTool(createdMcpServerId, {
      integrationName: 'openai',
      actionName: 'ask_chatgpt',
    })
    expect(result).toHaveProperty('tool')
    toolId = (result.tool as any).id
  })

  it('should update the tool', async () => {
    const result = await client.mcpServers.updateTool(createdMcpServerId, toolId, {
      displayName: 'Ask ChatGPT (renamed)',
    })
    expect(result).toHaveProperty('tool')
    expect((result.tool as any).displayName).toBe('Ask ChatGPT (renamed)')
  })

  it('should update the MCP server', async () => {
    const result = await client.mcpServers.update(createdMcpServerId, {
      name: 'SDK Test Server (updated)',
    })
    expect(result).toHaveProperty('server')
    expect((result.server as any).name).toBe('SDK Test Server (updated)')
  })

  it('should regenerate the bearer token', async () => {
    const result = await client.mcpServers.regenerateToken(createdMcpServerId)
    expect(result).toHaveProperty('bearerToken')
    expect(result.bearerToken).toMatch(/^mcp_/)
  })

  it('should delete the tool', async () => {
    const result = await client.mcpServers.deleteTool(createdMcpServerId, toolId)
    expect(result).toHaveProperty('deleted', true)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Triggers
// ────────────────────────────────────────────────────────────────────────────

describe('Triggers', () => {
  it('should list triggers (initially empty)', async () => {
    const result = await client.triggers.list()
    expect(result).toHaveProperty('triggers')
    expect(Array.isArray(result.triggers)).toBe(true)
  })

  it('should get sample trigger data', async () => {
    const result = await client.triggers.test('slack', 'new-message')
    expect(result).toHaveProperty('sampleData')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Activity
// ────────────────────────────────────────────────────────────────────────────

describe('Activity', () => {
  it('should list activity events', async () => {
    const result = await client.activity.list()
    expect(result).toHaveProperty('events')
    expect(result).toHaveProperty('total')
    expect(Array.isArray(result.events)).toBe(true)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// OAuth Apps
// ────────────────────────────────────────────────────────────────────────────

describe('OAuth Apps', () => {
  let oauthAppId: string

  it('should list OAuth apps', async () => {
    const result = await client.oauthApps.list()
    expect(result).toHaveProperty('apps')
    expect(Array.isArray(result.apps)).toBe(true)
  })

  it('should create and delete an OAuth app', async () => {
    const result = await client.oauthApps.create({
      integrationName: 'github',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    })
    expect(result).toHaveProperty('app')
    oauthAppId = (result.app as any).id

    const delResult = await client.oauthApps.delete(oauthAppId)
    expect(delResult).toHaveProperty('deleted', true)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Webhook Secrets
// ────────────────────────────────────────────────────────────────────────────

describe('Webhook Secrets', () => {
  it('should list webhook secrets', async () => {
    const result = await client.webhookSecrets.list()
    expect(result).toHaveProperty('secrets')
    expect(Array.isArray(result.secrets)).toBe(true)
  })

  it('should create a webhook secret', async () => {
    const result = await client.webhookSecrets.create({
      integrationName: 'slack',
      secret: 'test-webhook-secret-12345',
    })
    expect(result).toHaveProperty('success', true)
    expect(result).toHaveProperty('integrationName', 'slack')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Error Handling
// ────────────────────────────────────────────────────────────────────────────

describe('Error Handling', () => {
  it('should throw WeavzError on invalid API key', async () => {
    const badClient = new WeavzClient({ apiKey: 'wvz_invalid', baseUrl: BASE_URL })
    await expect(badClient.apiKeys.list()).rejects.toThrow(WeavzError)

    try {
      await badClient.apiKeys.list()
    } catch (e) {
      expect(e).toBeInstanceOf(WeavzError)
      expect((e as WeavzError).status).toBe(401)
    }
  })

  it('should throw WeavzError on not found', async () => {
    await expect(client.projects.get('nonexistent-id')).rejects.toThrow(WeavzError)
  })

  it('should throw WeavzError on validation error', async () => {
    await expect(
      client.projects.create({ name: '', slug: '' })
    ).rejects.toThrow(WeavzError)
  })
})
