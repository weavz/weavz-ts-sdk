# @weavz/sdk

TypeScript SDK for the [Weavz](https://weavz.io) API — integration and MCP infrastructure for connection management, MCP servers, triggers, and action execution.

## Installation

```bash
npm install @weavz/sdk
```

## Quick Start

```typescript
import { WeavzClient } from '@weavz/sdk'

const client = new WeavzClient({
  apiKey: 'wvz_your_api_key',
  baseUrl: 'https://api.weavz.io', // optional
})

const workspaceId = '550e8400-e29b-41d4-a716-446655440000'

// List connections
const { connections } = await client.connections.list()

// Expose configured Slack tools to MCP Code Mode through the `slack` alias
await client.workspaces.addIntegration(workspaceId, {
  integrationName: 'slack',
  alias: 'slack',
  connectionStrategy: 'per_user',
})

// Execute an action through the configured alias
const result = await client.actions.execute('slack', 'send_channel_message', {
  input: { channel: '#general', text: 'Hello from Weavz!' },
  workspaceId,
  integrationAlias: 'slack',
})

// Create an OAuth-enabled MCP server
const { server, mcpEndpoint } = await client.mcpServers.create({
  name: 'My MCP Server',
  mode: 'CODE',
  workspaceId,
  authMode: 'oauth',
  settings: { codeMode: { approvalWaitSeconds: 30 } },
})

// For provisioned clients, enable bearer auth and issue one token per end user:
const { server: bearerServer } = await client.mcpServers.create({
  name: 'Provisioned MCP Server',
  mode: 'CODE',
  workspaceId,
  authMode: 'oauth_and_bearer',
})
const { bearerToken } = await client.mcpServers.createBearerToken(bearerServer.id, {
  endUserId: 'user_123',
})

const run = await client.mcpServers.executeCode(server.id, 'return await weavz.slack.send_channel_message({ channel: "C123", text: "Hello" })')

// If Human Gates returns approval_required, approve it and fetch the stored run:
const approved = await client.mcpServers.executeCode(server.id, {
  approvalId: 'apr_9b36d3f761d84bb2b6f9a0c4b9d1f7e0',
  waitForApprovalSeconds: 30,
})
```

## Resources

The client provides namespaced access to all API resources:

| Resource | Methods |
|----------|---------|
| `client.workspaces` | `list()`, `create()`, `get()`, `update()`, `delete()`, `listIntegrations()`, `addIntegration()`, `updateIntegration()`, `removeIntegration()` |
| `client.connections` | `list()`, `get()`, `create()`, `delete()`, `resolve()` |
| `client.actions` | `execute()` |
| `client.triggers` | `list()`, `enable()`, `disable()`, `test()` |
| `client.mcpServers` | `list()`, `create()`, `get()`, `update()`, `delete()`, `regenerateToken()`, `createBearerToken()`, `createAccessToken()`, `createEndUserToken()`, `createOAuthToken()`, `addTool()`, `updateTool()`, `deleteTool()`, `executeCode()`, `getDeclarations()` |
| `client.apiKeys` | `list()`, `create()`, `delete()` |
| `client.integrations` | `list()`, `listSummary()`, `get()`, `resolveOptions()`, `resolveProperty()`, `oauthStatus()` |
| `client.connect` | `createToken()`, `poll()`, `wait()`, `getSession()`, `popup()` |
| `client.endUsers` | `create()`, `list()`, `get()`, `update()`, `delete()`, `createConnectToken()`, `invite()` |
| `client.partials` | `list()`, `get()`, `create()`, `update()`, `delete()`, `setDefault()` |
| `client.approvalPolicies` | `list()`, `create()`, `get()`, `update()`, `delete()`, `test()` |
| `client.approvals` | `list()`, `get()`, `approve()`, `reject()`, `cancel()`, `wait()` |

## Resource Options and Defaults

The SDK method names mirror the REST resources. Use the API reference for complete option tables, defaults, and bounds:

- [Actions](https://weavz.io/docs/api-reference/actions) — selectors, `partialIds`, `idempotencyKey`, and approval retry behavior
- [Triggers](https://weavz.io/docs/api-reference/triggers) — callback headers, metadata, partials, polling intervals, and simulation
- [Workspace Integrations](https://weavz.io/docs/api-reference/workspace-integrations) — aliases, connection strategies, enabled actions, persistence, and Advanced Code settings
- [MCP Servers](https://weavz.io/docs/api-reference/mcp-servers) — modes, auth modes, end-user access, server settings, bearer token scopes, and tool fields
- [End Users](https://weavz.io/docs/api-reference/end-users) — connect-token and invite TTLs, `integrationName`, and `workspaceIntegrationId`
- [Input Partials](https://weavz.io/docs/api-reference/input-partials) — default values, enforced keys, and default partial behavior
- [Approvals](https://weavz.io/docs/api-reference/approvals) — Human Gates policy matchers, defaults, approver shapes, and decision bodies
- [Connections](https://weavz.io/docs/api-reference/connections) and [Connect](https://weavz.io/docs/api-reference/oauth) — credential scope, hosted connect fields, OAuth app selection, and session expiry

## Building SaaS on Weavz

Org-wide API keys can provision the integration control plane for your own product: create workspaces, register end users, create hosted connect sessions, expose MCP servers, configure workspace integrations, and execute actions.

```typescript
const { workspace } = await client.workspaces.create({
  name: 'Production',
  slug: 'production',
})

await client.workspaces.addIntegration(workspace.id, {
  integrationName: 'slack',
  alias: 'customer_slack',
  connectionStrategy: 'per_user',
})
```

## AI Framework Adapters

MCP is the primary hosted agent surface. These adapters are a local compatibility layer for SaaS builders who need configured workspace actions as framework-native tools without adding framework dependencies to the base package.

```typescript
import { createMcpServerActionTools, toOpenAIResponsesTool, toAnthropicTool } from '@weavz/sdk'

const tools = await createMcpServerActionTools(client, '660e8400-e29b-41d4-a716-446655440000')
const openaiTools = tools.map(toOpenAIResponsesTool)
const anthropicTools = tools.map(toAnthropicTool)
```

## Error Handling

```typescript
import { WeavzClient, WeavzError } from '@weavz/sdk'

try {
  await client.actions.execute('slack', 'send_channel_message', {
    workspaceId: '550e8400-e29b-41d4-a716-446655440000',
    input: { channel: '#general', text: 'Hello!' },
  })
} catch (err) {
  if (err instanceof WeavzError) {
    console.error(err.code)    // 'ACTION_FAILED'
    console.error(err.status)  // 400
    console.error(err.details) // additional context
  }
}
```

## Typed Integration Inputs

After running the schema generator (`npm run generate:integrations`), the SDK includes typed interfaces, literal action names, and helper maps for all generated integration action inputs:

```typescript
import { integrationActions, integrationNames, isKnownActionName } from '@weavz/sdk'
import type {
  ActionInput,
  ActionName,
  ActionPropertyName,
  IntegrationActionKey,
  IntegrationName,
  SlackSendChannelMessageInput,
} from '@weavz/sdk'

const input: SlackSendChannelMessageInput = {
  channel: '#general',
  text: 'Hello!',
}

const name: IntegrationName = 'slack'
const action: ActionName<'slack'> = 'send_channel_message'
const typedInput: ActionInput<'slack', 'send_channel_message'> = input
const property: ActionPropertyName<'slack', 'send_channel_message'> = 'channel'
const key: IntegrationActionKey = 'slack.send_channel_message'

console.log(integrationNames.includes(name))
console.log(integrationActions.slack.includes(action))

const dynamicActionName = 'send_channel_message'
if (isKnownActionName('slack', dynamicActionName)) {
  await client.actions.execute('slack', dynamicActionName, {
    workspaceId,
    input: typedInput,
  })
}
```

Known integration/action literal pairs are type-checked by `client.actions.execute()`, `client.integrations.get()`, `client.integrations.resolveOptions()`, and `client.integrations.resolveProperty()`. Plain strings still work for future or custom integrations, but they use the dynamic fallback type.

## License

MIT
