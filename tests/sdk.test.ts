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

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'
const SERVICE_KEY = 'local-test-service-key-12345'
let TEST_ORG_ID = ''

let client: WeavzClient
let apiKeyPlain: string
let apiKeyId: string

// Track resources for cleanup
let createdWorkspaceId: string
let createdConnectionId: string
let createdMcpServerId: string
let createdWorkspaceIntegrationId: string
let createdOpenAiWorkspaceIntegrationId: string
let createdBearerWorkspaceId: string
let createdBearerMcpServerId: string
let createdApprovalWorkspaceId: string
let createdApprovalPolicyId: string

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

  // Create a test org
  const orgRes = await fetch(`${BASE_URL}/api/v1/orgs`, {
    method: 'POST',
    headers: { 'X-Service-Key': SERVICE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'SDK Test Org', slug: `sdk-test-${Date.now()}` }),
  })
  if (!orgRes.ok) throw new Error(`Failed to create org: ${orgRes.status} ${await orgRes.text()}`)
  const orgData = (await orgRes.json()) as { org: { id: string } }
  TEST_ORG_ID = orgData.org.id

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
    if (createdOpenAiWorkspaceIntegrationId) await client.workspaces.removeIntegration(createdWorkspaceId, createdOpenAiWorkspaceIntegrationId)
  } catch {}
  try {
    if (createdWorkspaceIntegrationId) await client.workspaces.removeIntegration(createdWorkspaceId, createdWorkspaceIntegrationId)
  } catch {}
  try {
    if (createdMcpServerId) await client.mcpServers.delete(createdMcpServerId)
  } catch {}
  try {
    if (createdBearerMcpServerId) await client.mcpServers.delete(createdBearerMcpServerId)
  } catch {}
  try {
    if (createdConnectionId) await client.connections.delete(createdConnectionId)
  } catch {}
  try {
    if (createdApprovalPolicyId) await client.approvalPolicies.delete(createdApprovalPolicyId)
  } catch {}
  try {
    if (createdApprovalWorkspaceId) await client.workspaces.delete(createdApprovalWorkspaceId)
  } catch {}
  try {
    if (createdBearerWorkspaceId) await client.workspaces.delete(createdBearerWorkspaceId)
  } catch {}
  try {
    if (createdWorkspaceId) await client.workspaces.delete(createdWorkspaceId)
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
// Workspaces
// ────────────────────────────────────────────────────────────────────────────

describe('Workspaces', () => {
  it('should create a workspace', async () => {
    const result = await client.workspaces.create({
      name: 'SDK Test Workspace',
      slug: 'sdk-test-workspace',
    })
    expect(result).toHaveProperty('workspace')
    expect((result.workspace as any).name).toBe('SDK Test Workspace')
    expect((result.workspace as any).slug).toBe('sdk-test-workspace')
    createdWorkspaceId = (result.workspace as any).id
  })

  it('should list workspaces', async () => {
    const result = await client.workspaces.list()
    expect(result).toHaveProperty('workspaces')
    expect(result.workspaces.length).toBeGreaterThan(0)
  })

  it('should get a specific workspace', async () => {
    const result = await client.workspaces.get(createdWorkspaceId)
    expect(result).toHaveProperty('workspace')
    expect((result.workspace as any).id).toBe(createdWorkspaceId)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Human Gates / Approvals
// ────────────────────────────────────────────────────────────────────────────

describe('Approvals', () => {
  it('should manage approval policies and list approval requests', async () => {
    const suffix = Date.now().toString(36)
    const workspace = await client.workspaces.create({
      name: 'SDK Approval Workspace',
      slug: `sdk-approval-${suffix}`,
    })
    createdApprovalWorkspaceId = (workspace.workspace as any).id

    const policyInput = {
      workspaceId: createdApprovalWorkspaceId,
      name: 'SDK approval policy',
      description: 'Created by the TypeScript SDK test suite',
      sources: ['sdk'] as const,
      decision: 'require_approval' as const,
      riskMode: 'always' as const,
      approvers: [{ type: 'org_role' as const, roles: ['owner', 'admin'] as const }],
      timeoutSeconds: 3600,
      defaultOnTimeout: 'reject' as const,
      approvalAccessMode: 'dashboard_only' as const,
    }

    const created = await client.approvalPolicies.create(policyInput)
    createdApprovalPolicyId = created.policy.id
    expect(created.policy.name).toBe(policyInput.name)
    expect(created.policy.workspaceId).toBe(createdApprovalWorkspaceId)
    expect(created.policy.approvalAccessMode).toBe('dashboard_only')

    const listed = await client.approvalPolicies.list({ workspaceId: createdApprovalWorkspaceId })
    expect(listed.policies.some(policy => policy.id === createdApprovalPolicyId)).toBe(true)

    const fetched = await client.approvalPolicies.get(createdApprovalPolicyId)
    expect(fetched.policy.id).toBe(createdApprovalPolicyId)

    const tested = await client.approvalPolicies.test({
      policy: policyInput,
      context: {
        workspaceId: createdApprovalWorkspaceId,
        source: 'sdk',
        integrationName: 'openai',
        actionName: 'chat_completion',
        input: { prompt: 'hello' },
      },
    })
    expect(tested.matched).toBe(true)
    expect(tested.decision).toBe('require_approval')

    const updated = await client.approvalPolicies.update(createdApprovalPolicyId, { enabled: false })
    expect(updated.policy.enabled).toBe(false)

    const approvals = await client.approvals.list({ workspaceId: createdApprovalWorkspaceId, status: 'pending', limit: 5 })
    expect(Array.isArray(approvals.approvals)).toBe(true)

    const deleted = await client.approvalPolicies.delete(createdApprovalPolicyId)
    expect(deleted.deleted).toBe(true)
    createdApprovalPolicyId = ''
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
      workspaceId: createdWorkspaceId,
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
      workspaceId: createdWorkspaceId,
    })
    expect(result).toHaveProperty('connection')
    expect((result.connection as any).id).toBe(createdConnectionId)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Workspace Integrations
// ────────────────────────────────────────────────────────────────────────────

describe('Workspace Integrations', () => {
  it('should add an integration to a workspace', async () => {
    const result = await client.workspaces.addIntegration(createdWorkspaceId, {
      integrationName: 'slack',
      connectionStrategy: 'per_user',
    })
    expect(result).toHaveProperty('integration')
    expect((result.integration as any).integrationName).toBe('slack')
    expect((result.integration as any).connectionStrategy).toBe('per_user')
    createdWorkspaceIntegrationId = (result.integration as any).id
  })

  it('should list workspace integrations', async () => {
    const result = await client.workspaces.listIntegrations(createdWorkspaceId)
    expect(result).toHaveProperty('integrations')
    expect(result).toHaveProperty('total')
    expect(result.integrations.length).toBeGreaterThan(0)
  })

  it('should update a workspace integration', async () => {
    const result = await client.workspaces.updateIntegration(createdWorkspaceId, createdWorkspaceIntegrationId, {
      connectionStrategy: 'per_user_with_fallback',
    })
    expect(result).toHaveProperty('integration')
    expect((result.integration as any).connectionStrategy).toBe('per_user_with_fallback')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Input Partials
// ────────────────────────────────────────────────────────────────────────────

describe('Input Partials', () => {
  let partialId: string

  beforeAll(async () => {
    const result = await client.workspaces.addIntegration(createdWorkspaceId, {
      integrationName: 'openai',
      alias: 'openai_primary',
      connectionStrategy: 'fixed',
      connectionId: createdConnectionId,
    })
    createdOpenAiWorkspaceIntegrationId = result.integration.id
  })

  it('should create an input partial', async () => {
    const result = await client.partials.create({
      workspaceId: createdWorkspaceId,
      integrationName: 'openai',
      name: 'SDK Test Partial',
      description: 'Test partial from SDK tests',
      values: { model: 'gpt-4o', temperature: 0.7 },
      enforcedKeys: ['model'],
    })
    expect(result).toHaveProperty('partial')
    expect(result.partial.name).toBe('SDK Test Partial')
    expect(result.partial.integrationName).toBe('openai')
    expect(result.partial.values).toEqual({ model: 'gpt-4o', temperature: 0.7 })
    expect(result.partial.enforcedKeys).toEqual(['model'])
    expect(result.partial.isDefault).toBe(false)
    partialId = result.partial.id
  })

  it('should list partials for a project', async () => {
    const result = await client.partials.list({ workspaceId: createdWorkspaceId })
    expect(result).toHaveProperty('partials')
    expect(result).toHaveProperty('total')
    expect(result.partials.length).toBeGreaterThan(0)
    expect(result.partials.some(p => p.id === partialId)).toBe(true)
  })

  it('should list partials filtered by integrationName', async () => {
    const result = await client.partials.list({ workspaceId: createdWorkspaceId, integrationName: 'openai' })
    expect(result.partials.length).toBeGreaterThan(0)
    expect(result.partials.every(p => p.integrationName === 'openai')).toBe(true)
  })

  it('should get a specific partial', async () => {
    const result = await client.partials.get(partialId)
    expect(result).toHaveProperty('partial')
    expect(result.partial.id).toBe(partialId)
    expect(result.partial.name).toBe('SDK Test Partial')
  })

  it('should update a partial', async () => {
    const result = await client.partials.update(partialId, {
      name: 'SDK Test Partial (updated)',
      description: 'Updated description',
      values: { model: 'gpt-4o', temperature: 0.9 },
    })
    expect(result).toHaveProperty('partial')
    expect(result.partial.name).toBe('SDK Test Partial (updated)')
    expect(result.partial.description).toBe('Updated description')
    expect(result.partial.values).toEqual({ model: 'gpt-4o', temperature: 0.9 })
  })

  it('should set a partial as default', async () => {
    const result = await client.partials.setDefault(partialId, true)
    expect(result).toHaveProperty('partial')
    expect(result.partial.isDefault).toBe(true)
  })

  it('should unset a partial as default', async () => {
    const result = await client.partials.setDefault(partialId, false)
    expect(result).toHaveProperty('partial')
    expect(result.partial.isDefault).toBe(false)
  })

  it('should delete a partial', async () => {
    const result = await client.partials.delete(partialId)
    expect(result).toHaveProperty('deleted', true)
    expect(result).toHaveProperty('id', partialId)
  })

  it('should return 404 for deleted partial', async () => {
    await expect(client.partials.get(partialId)).rejects.toThrow(WeavzError)
    try {
      await client.partials.get(partialId)
    } catch (e) {
      expect((e as WeavzError).status).toBe(404)
    }
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
      workspaceId: createdWorkspaceId,
      mode: 'TOOLS',
    })
    expect(result).toHaveProperty('server')
    expect(result).not.toHaveProperty('bearerToken')
    expect((result.server as any).authMode).toBe('oauth')
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
      actionName: 'chat_completion',
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

  it('should create an end-user OAuth MCP token', async () => {
    const externalId = `sdk-mcp-eu-${Date.now()}`
    const endUser = await client.endUsers.create({
      workspaceId: createdWorkspaceId,
      externalId,
      displayName: 'SDK MCP OAuth End User',
      email: 'sdk-mcp-oauth@example.com',
    })

    try {
      const result = await client.mcpServers.createOAuthToken(createdMcpServerId, {
        endUserId: externalId,
        scopes: ['mcp:tools'],
        expiresIn: 3600,
      })
      expect(result).toHaveProperty('accessToken')
      expect(result.accessToken).toMatch(/^mcpo_/)
      expect(result).toHaveProperty('mcpEndpoint')
      expect(result.token.scopes).toContain('mcp:tools')
      expect(result.token.endUserId).toBe(externalId)
    } finally {
      await client.endUsers.delete((endUser.endUser as any).id)
    }
  })

  it('should reject bearer token regeneration when bearer auth is disabled', async () => {
    await expect(client.mcpServers.regenerateToken(createdMcpServerId)).rejects.toThrow(WeavzError)
    try {
      await client.mcpServers.regenerateToken(createdMcpServerId)
    } catch (e) {
      expect((e as WeavzError).status).toBe(409)
    }
  })

  it('should support bearer auth in a workspace without per-user integrations', async () => {
    const workspace = await client.workspaces.create({
      name: 'SDK Bearer Workspace',
      slug: `sdk-bearer-${Date.now()}`,
    })
    createdBearerWorkspaceId = (workspace.workspace as any).id

    const server = await client.mcpServers.create({
      name: 'SDK Bearer Server',
      workspaceId: createdBearerWorkspaceId,
      mode: 'TOOLS',
      authMode: 'bearer',
    })
    createdBearerMcpServerId = (server.server as any).id

    expect(server).toHaveProperty('bearerToken')
    expect(server.bearerToken).toMatch(/^mcp_/)
    expect((server.server as any).authMode).toBe('bearer')

    const result = await client.mcpServers.regenerateToken(createdBearerMcpServerId)
    expect(result).toHaveProperty('bearerToken')
    expect(result.bearerToken).toMatch(/^mcp_/)
  })

  it('should create end-user bearer tokens for bearer MCP servers', async () => {
    const externalId = `sdk-bearer-eu-${Date.now()}`
    const endUser = await client.endUsers.create({
      workspaceId: createdBearerWorkspaceId,
      externalId,
      displayName: 'SDK Bearer MCP End User',
      email: 'sdk-bearer-mcp@example.com',
    })

    try {
      const result = await client.mcpServers.createBearerToken(createdBearerMcpServerId, {
        endUserId: externalId,
        scopes: ['mcp:tools'],
        expiresIn: 3600,
      })
      expect(result).toHaveProperty('bearerToken')
      expect(result.bearerToken).toMatch(/^mcp_/)
      expect(result.accessToken).toBe(result.bearerToken)
      expect(result.token.endUserId).toBe(externalId)
      expect(result.token.authMethod).toBe('bearer')
      expect(result.token.tokenType).toBe('mcp_bearer')
    } finally {
      await client.endUsers.delete((endUser.endUser as any).id)
    }
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
    const result = await client.triggers.test('slack', 'new_message')
    expect(result).toHaveProperty('sampleData')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// endUserId Parameter
// ────────────────────────────────────────────────────────────────────────────

describe('endUserId Parameter', () => {
  it('should create a connection with endUserId', async () => {
    const result = await client.connections.create({
      type: 'SECRET_TEXT',
      externalId: 'sdk-enduser-test',
      displayName: 'endUserId Test Connection',
      integrationName: 'openai',
      secretText: 'sk-test-enduser-key',
      workspaceId: createdWorkspaceId,
      endUserId: 'end-user-ts-001',
    })
    expect(result).toHaveProperty('connection')
    expect((result.connection as any).endUserId).toBe('end-user-ts-001')
    expect(result.connection).not.toHaveProperty('userId')

    // Cleanup
    await client.connections.delete((result.connection as any).id)
  })

  it('should resolve a connection with endUserId', async () => {
    // Create a connection with endUserId first
    const created = await client.connections.create({
      type: 'SECRET_TEXT',
      externalId: 'sdk-resolve-enduser',
      displayName: 'Resolve endUserId Test',
      integrationName: 'openai',
      secretText: 'sk-test-resolve-enduser',
      workspaceId: createdWorkspaceId,
      endUserId: 'end-user-ts-002',
    })

    const result = await client.connections.resolve({
      integrationName: 'openai',
      externalId: 'sdk-resolve-enduser',
      workspaceId: createdWorkspaceId,
      endUserId: 'end-user-ts-002',
    })
    expect(result).toHaveProperty('connection')
    expect((result.connection as any).endUserId).toBe('end-user-ts-002')

    // Cleanup
    await client.connections.delete((created.connection as any).id)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Workspace-Scoped API Keys
// ────────────────────────────────────────────────────────────────────────────

describe('Workspace-Scoped API Keys', () => {
  it('should create a workspace-scoped API key', async () => {
    const result = await client.apiKeys.create({
      name: 'workspace-scoped-test-key',
      permissions: { scope: 'workspace', workspaceIds: [createdWorkspaceId] },
    })
    expect(result).toHaveProperty('plainKey')
    expect(result.plainKey).toMatch(/^wvz_/)
    expect((result.apiKey as any).permissions).toEqual({
      scope: 'workspace',
      workspaceIds: [createdWorkspaceId],
    })

    // Cleanup
    await client.apiKeys.delete((result.apiKey as any).id)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// End Users
// ────────────────────────────────────────────────────────────────────────────

describe('End Users', () => {
  let endUserId: string

  it('should create an end user', async () => {
    const result = await client.endUsers.create({
      workspaceId: createdWorkspaceId,
      externalId: `sdk-eu-${Date.now()}`,
      displayName: 'SDK Test End User',
      email: 'sdk-enduser@example.com',
      metadata: { plan: 'pro' },
    })
    expect(result).toHaveProperty('endUser')
    expect(result.endUser.displayName).toBe('SDK Test End User')
    expect(result.endUser.email).toBe('sdk-enduser@example.com')
    expect(result.endUser.externalId).toBeTruthy()
    expect(result.endUser.type).toBe('external')
    endUserId = result.endUser.id
  })

  it('should list end users by project', async () => {
    const result = await client.endUsers.list({ workspaceId: createdWorkspaceId })
    expect(result).toHaveProperty('endUsers')
    expect(result).toHaveProperty('total')
    expect(result.endUsers.length).toBeGreaterThan(0)
    expect(result.endUsers.some((eu: any) => eu.id === endUserId)).toBe(true)
  })

  it('should get a specific end user', async () => {
    const result = await client.endUsers.get(endUserId)
    expect(result).toHaveProperty('endUser')
    expect(result.endUser.id).toBe(endUserId)
    expect(result.endUser.displayName).toBe('SDK Test End User')
    expect(result).toHaveProperty('connections')
    expect(Array.isArray(result.connections)).toBe(true)
  })

  it('should update an end user', async () => {
    const result = await client.endUsers.update(endUserId, {
      displayName: 'Updated End User',
      email: 'updated@example.com',
    })
    expect(result).toHaveProperty('endUser')
    expect(result.endUser.displayName).toBe('Updated End User')
    expect(result.endUser.email).toBe('updated@example.com')
  })

  it('should create a connect token', async () => {
    const result = await client.endUsers.createConnectToken(endUserId)
    expect(result).toHaveProperty('connectUrl')
    expect(result).toHaveProperty('token')
    expect(result).toHaveProperty('expiresAt')
    expect(result.token).toMatch(/^eut_/)
    expect(result.connectUrl).toContain('/connect/portal')
  })

  it('should create a connect token with integration filter', async () => {
    const result = await client.endUsers.createConnectToken(endUserId, {
      integrationName: 'slack',
      expiresIn: 86400,
    })
    expect(result).toHaveProperty('token')
    expect(result.token).toMatch(/^eut_/)
  })

  it('should delete an end user', async () => {
    const result = await client.endUsers.delete(endUserId)
    expect(result).toHaveProperty('deleted', true)
    expect(result).toHaveProperty('id', endUserId)
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
    await expect(client.workspaces.get('nonexistent-id')).rejects.toThrow(WeavzError)
  })

  it('should throw WeavzError on validation error', async () => {
    await expect(
      client.workspaces.create({ name: '', slug: '' })
    ).rejects.toThrow(WeavzError)
  })
})
