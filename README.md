# @weavz/sdk

TypeScript SDK for the [Weavz](https://weavz.io) API — an embedded iPaaS for connection management, MCP servers, triggers, and action execution.

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
  workspaceId: 'your-workspace-id',
})

// Create an MCP server
const { server, bearerToken } = await client.mcpServers.create({
  name: 'My MCP Server',
  mode: 'TOOLS',
  workspaceId: 'your-workspace-id',
})
```

## Resources

The client provides namespaced access to all API resources:

| Resource | Methods |
|----------|---------|
| `client.workspaces` | `list()`, `create()`, `get()`, `delete()`, `listIntegrations()`, `addIntegration()`, `updateIntegration()`, `removeIntegration()` |
| `client.connections` | `list()`, `create()`, `delete()`, `resolve()` |
| `client.actions` | `execute()` |
| `client.triggers` | `list()`, `enable()`, `disable()`, `test()` |
| `client.mcpServers` | `list()`, `create()`, `get()`, `update()`, `delete()`, `regenerateToken()`, `addTool()`, `updateTool()`, `deleteTool()`, `executeCode()`, `syncFromWorkspace()` |
| `client.apiKeys` | `list()`, `create()`, `delete()` |
| `client.members` | `list()`, `create()`, `update()`, `delete()` |
| `client.integrations` | `list()`, `get()`, `resolveOptions()`, `resolveProperty()`, `oauthStatus()` |
| `client.oauthApps` | `list()`, `create()`, `delete()` |
| `client.webhookSecrets` | `list()`, `create()`, `delete()` |
| `client.activity` | `list()` |
| `client.endUsers` | `create()`, `list()`, `get()`, `update()`, `delete()`, `createConnectToken()`, `invite()` |
| `client.partials` | `list()`, `get()`, `create()`, `update()`, `delete()` |
| `client.invitations` | `send()`, `list()`, `revoke()`, `accept()` |

## Error Handling

```typescript
import { WeavzClient, WeavzError } from '@weavz/sdk'

try {
  await client.actions.execute('slack', 'send_channel_message', { input: {} })
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
