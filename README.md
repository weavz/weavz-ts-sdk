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

// List connections
const { connections } = await client.connections.list()

// Execute an action
const result = await client.actions.execute('slack', 'send_channel_message', {
  input: { channel: '#general', text: 'Hello from Weavz!' },
  connectionExternalId: 'my-slack',
  workspaceId: '550e8400-e29b-41d4-a716-446655440000',
})

// Create an OAuth-enabled MCP server
const { server, mcpEndpoint } = await client.mcpServers.create({
  name: 'My MCP Server',
  mode: 'CODE',
  workspaceId: '550e8400-e29b-41d4-a716-446655440000',
  authMode: 'oauth',
})

const run = await client.mcpServers.executeCode(server.id, 'return await weavz.slack.send_channel_message({ channel: "C123", text: "Hello" })')

// If Human Gates returns approval_required, approve it and fetch the stored run:
const approved = await client.mcpServers.executeCode(server.id, {
  approvalId: 'apr_9b36d3f761d84bb2b6f9a0c4b9d1f7e0',
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
| `client.mcpServers` | `list()`, `create()`, `get()`, `update()`, `delete()`, `regenerateToken()`, `createOAuthToken()`, `addTool()`, `updateTool()`, `deleteTool()`, `executeCode()`, `getDeclarations()` |
| `client.apiKeys` | `list()`, `create()`, `delete()` |
| `client.integrations` | `list()`, `listSummary()`, `get()`, `resolveOptions()`, `resolveProperty()`, `oauthStatus()` |
| `client.connect` | `createToken()`, `poll()`, `wait()`, `getSession()`, `popup()` |
| `client.endUsers` | `create()`, `list()`, `get()`, `update()`, `delete()`, `createConnectToken()`, `invite()` |
| `client.partials` | `list()`, `get()`, `create()`, `update()`, `delete()` |

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
    input: {},
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

After running the schema generator (`npm run generate:integrations`), the SDK includes typed interfaces for all integration action inputs:

```typescript
import type { SlackSendChannelMessageInput } from '@weavz/sdk'

const input: SlackSendChannelMessageInput = {
  channel: '#general',
  text: 'Hello!',
}
```

## License

MIT
