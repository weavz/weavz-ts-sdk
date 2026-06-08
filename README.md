# Weavz TypeScript SDK

Official TypeScript SDK for [Weavz](https://weavz.io), the stateful agent runtime for SaaS and AI products.

Weavz gives your product one API for connection management, end-user identity, hosted connect flows, action execution, triggers, MCP servers, Human Gates, input partials, Filesystem, State KV, Sandbox execution, and 500+ integrations.

## Links

- [Weavz](https://weavz.io)
- [Dashboard](https://platform.weavz.io)
- [Documentation](https://weavz.io/docs)
- [TypeScript SDK docs](https://weavz.io/docs/sdks/typescript)
- [API reference](https://weavz.io/docs/api-reference)
- [Integration catalog](https://weavz.io/integrations)

## Installation

```bash
npm install @weavz/sdk
```

The package ships ESM, CommonJS, and TypeScript declarations.

```typescript
import { WeavzClient } from '@weavz/sdk'

const client = new WeavzClient({
  apiKey: process.env.WEAVZ_API_KEY!,
})
```

## What You Can Build

- Hosted OAuth and credential connection flows for your customers
- Multi-tenant workspaces with per-user, fixed, or fallback connection strategies
- Typed action execution across integrations such as Slack, GitHub, Google Sheets, HubSpot, Notion, Stripe, and more
- Remote MCP servers for Claude, ChatGPT, Codex, Cursor, and custom agents
- Code Mode MCP servers where agents search, inspect, and call workspace integrations dynamically
- Tool Mode MCP servers with a small explicit tool list
- Filesystem and State KV for durable files, checkpoints, cursors, and lightweight agent state
- Sandbox workflows that run JavaScript, Python, or Shell through the runtime
- Human Gates for approvals before sensitive actions run
- Input partials for defaults, locked fields, and reusable action configuration
- Triggers and webhooks that forward integration events into your product

## Quick Start

This example creates a workspace, enables a built-in integration, and executes an action through the SDK.

```typescript
import { WeavzClient } from '@weavz/sdk'

const client = new WeavzClient({
  apiKey: process.env.WEAVZ_API_KEY!,
})

const { workspace } = await client.workspaces.create({
  name: 'Production',
  slug: 'production',
})

await client.workspaces.addIntegration(workspace.id, {
  integrationName: 'hash-encode',
  alias: 'hash',
})

const result = await client.actions.execute('hash-encode', 'hash', {
  workspaceId: workspace.id,
  integrationAlias: 'hash',
  input: {
    text: 'hello from weavz',
    algorithm: 'sha256',
    encoding: 'hex',
  },
})

if (result.success) {
  console.log(result.output)
}
```

For a guided Slack setup, see the [Quick Start](https://weavz.io/docs/getting-started/quick-start).

## Configuration

```typescript
const client = new WeavzClient({
  apiKey: process.env.WEAVZ_API_KEY!,
  baseUrl: 'https://api.weavz.io',
  timeout: 310_000,
  maxRetries: 2,
  headers: { 'X-App-Version': '1.0.0' },
  userAgent: 'my-product/1.0.0',
  onRetry: ({ attempt, delayMs, error }) => {
    console.warn(`retry ${attempt} in ${delayMs}ms`, error.code)
  },
})
```

| Option | Required | Default | Description |
| --- | --- | --- | --- |
| `apiKey` | Yes | - | Weavz API key with the `wvz_` prefix |
| `baseUrl` | No | `https://api.weavz.io` | API base URL |
| `timeout` | No | `310000` | Request timeout in milliseconds |
| `maxRetries` | No | `2` | Retry count for transient failures |
| `fetch` | No | global `fetch` | Custom fetch implementation |
| `headers` | No | `{}` | Extra headers sent with every request |
| `userAgent` | No | - | User-Agent header value |
| `onRetry` | No | - | Callback before retryable requests are retried |

## Core Product Flows

### Workspaces And Integration Aliases

Workspaces scope connections, integration configuration, MCP servers, partials, triggers, and end-user access. Add integrations to a workspace under purpose-readable aliases so agents and logs show stable names.

```typescript
const { workspace } = await client.workspaces.create({
  name: 'Acme Customer',
  slug: 'acme-customer',
})

await client.workspaces.addIntegration(workspace.id, {
  integrationName: 'slack',
  alias: 'customer_slack',
  connectionStrategy: 'per_user',
  enabledActions: ['send_channel_message'],
})
```

Read more:

- [Organizations and workspaces](https://weavz.io/docs/concepts/organizations-and-workspaces)
- [Workspace integrations](https://weavz.io/docs/concepts/integration-selectors)
- [Integration aliases](https://weavz.io/docs/guides/integration-aliases)

### Hosted Connect

Create a hosted connect session when an end user needs to connect Slack, Google, GitHub, or another integration account.

```typescript
const session = await client.connect.createToken({
  integrationName: 'slack',
  connectionName: 'Acme Slack',
  externalId: 'acme_slack',
  workspaceId: workspace.id,
  endUserId: 'user_123',
})

// Browser apps can use the popup helper.
const connected = await client.connect.popup({
  token: session.token,
  connectUrl: session.connectUrl,
})

console.log(connected.connectionId)
```

Server-side apps can send `session.connectUrl` to the user and then wait for completion:

```typescript
const completed = await client.connect.wait(session.token, {
  timeoutMs: 120_000,
  intervalMs: 1_000,
})

if (completed.status === 'COMPLETED') {
  console.log(completed.connectionId)
}
```

Read more:

- [Connections](https://weavz.io/docs/concepts/connections)
- [Hosted connect API](https://weavz.io/docs/api-reference/oauth)
- [Setting up connections](https://weavz.io/docs/guides/setting-up-connections)

### Execute Actions

Execute integration actions directly from your backend or product workflows.

```typescript
const run = await client.actions.execute('slack', 'send_channel_message', {
  workspaceId: workspace.id,
  integrationAlias: 'customer_slack',
  endUserId: 'user_123',
  input: {
    channel: '#support',
    text: 'New customer escalation received.',
  },
  idempotencyKey: 'ticket_123_notify_slack',
})

if ('approval' in run) {
  console.log('Approval required:', run.approval.id)
} else {
  console.log('Action output:', run.output)
}
```

Read more:

- [Actions](https://weavz.io/docs/concepts/actions)
- [Executing actions](https://weavz.io/docs/guides/executing-actions)
- [Actions API reference](https://weavz.io/docs/api-reference/actions)

### MCP Servers For Agents

Create remote MCP servers that expose workspace integrations to AI agents. Code Mode is the best default for broad agent workspaces; Tool Mode is useful for small explicit tool surfaces.

```typescript
const { server, mcpEndpoint } = await client.mcpServers.create({
  name: 'Acme Agent Workspace',
  mode: 'CODE',
  workspaceId: workspace.id,
  authMode: 'oauth_and_bearer',
  endUserAccess: 'restricted',
  settings: {
    codeMode: {
      approvalWaitSeconds: 30,
    },
  },
})

const { bearerToken } = await client.mcpServers.createBearerToken(server.id, {
  endUserId: 'user_123',
  scopes: ['mcp:tools', 'mcp:code'],
  expiresIn: 60 * 60 * 24 * 30,
})

console.log(mcpEndpoint, bearerToken)
```

You can also run Code Mode directly through the SDK:

```typescript
const codeRun = await client.mcpServers.executeCode(server.id, `
  const parsed = await weavz.datetime.parse_date({
    dateString: "June 18, 2026 9am",
    timezone: "America/New_York"
  })

  return { parsed }
`)
```

Read more:

- [MCP servers](https://weavz.io/docs/concepts/mcp-servers)
- [MCP Code Mode](https://weavz.io/docs/guides/mcp-code-mode)
- [MCP Tool Mode](https://weavz.io/docs/guides/mcp-tool-mode)
- [Weavz MCP App](https://weavz.io/docs/guides/weavz-mcp-app)

### Human Gates

Human Gates let you require approval before sensitive actions execute.

```typescript
const { policy } = await client.approvalPolicies.create({
  workspaceId: workspace.id,
  name: 'Approve external messages',
  sources: ['sdk', 'mcp_code', 'mcp_tools'],
  decision: 'require_approval',
  riskMode: 'always',
  approvers: [{ type: 'org_role', roles: ['owner', 'admin'] }],
  timeoutSeconds: 3600,
  defaultOnTimeout: 'reject',
  approvalAccessMode: 'dashboard_and_hosted_link',
})

const guarded = await client.actions.execute('slack', 'send_channel_message', {
  workspaceId: workspace.id,
  integrationAlias: 'customer_slack',
  endUserId: 'user_123',
  input: { channel: '#general', text: 'Launch update' },
})

if ('approval' in guarded) {
  await client.approvals.approve(guarded.approval.id, {
    reason: 'Message reviewed',
  })
}
```

Read more:

- [Human Gates guide](https://weavz.io/docs/guides/human-gates)
- [Approvals API reference](https://weavz.io/docs/api-reference/approvals)

### Input Partials

Input partials let you reuse defaults and lock enforced fields so agents or callers only provide the fields they should control.

```typescript
const { partial } = await client.partials.create({
  workspaceId: workspace.id,
  integrationName: 'slack',
  actionName: 'send_channel_message',
  name: 'Support channel default',
  values: { channel: '#support' },
  enforcedKeys: ['channel'],
})

await client.actions.execute('slack', 'send_channel_message', {
  workspaceId: workspace.id,
  integrationAlias: 'customer_slack',
  partialIds: [partial.id],
  input: { text: 'A new ticket needs attention.' },
})
```

Read more:

- [Input partials](https://weavz.io/docs/concepts/input-partials)
- [Using input partials](https://weavz.io/docs/guides/using-input-partials)

### Triggers

Enable triggers to receive integration events in your own webhook endpoint.

```typescript
const { triggerSource } = await client.triggers.enable({
  integrationName: 'github',
  triggerName: 'new_push',
  workspaceId: workspace.id,
  integrationAlias: 'customer_github',
  callbackUrl: 'https://yourapp.example.com/webhooks/weavz/github',
  callbackMetadata: { customerId: 'acme' },
})

console.log(triggerSource.id)
```

Read more:

- [Triggers](https://weavz.io/docs/concepts/triggers)
- [Setting up triggers](https://weavz.io/docs/guides/setting-up-triggers)

## Typed Integration Inputs

The SDK includes generated TypeScript types and helper maps for integration action inputs.

```typescript
import { integrationActions, integrationNames, isKnownActionName } from '@weavz/sdk'
import type {
  ActionInput,
  ActionName,
  IntegrationName,
  SlackSendChannelMessageInput,
} from '@weavz/sdk'

const integration: IntegrationName = 'slack'
const action: ActionName<'slack'> = 'send_channel_message'

const input: SlackSendChannelMessageInput = {
  channel: '#general',
  text: 'Typed input from TypeScript',
}

const typedInput: ActionInput<'slack', 'send_channel_message'> = input

console.log(integrationNames.includes(integration))
console.log(integrationActions.slack.includes(action))

const actionFromUser = 'send_channel_message'
if (isKnownActionName('slack', actionFromUser)) {
  await client.actions.execute('slack', actionFromUser, {
    workspaceId: workspace.id,
    integrationAlias: 'customer_slack',
    input: typedInput,
  })
}
```

Known integration/action literal pairs are type-checked by:

- `client.actions.execute()`
- `client.integrations.get()`
- `client.integrations.resolveOptions()`
- `client.integrations.resolveProperty()`

Plain strings still work for future or custom integrations through the dynamic fallback type.

## AI Framework Adapters

MCP is the primary hosted agent surface. The SDK also includes small dependency-free adapters that convert configured workspace actions into common AI tool shapes.

```typescript
import {
  createMcpServerActionTools,
  toAnthropicTool,
  toOpenAIResponsesTool,
} from '@weavz/sdk'

const tools = await createMcpServerActionTools(client, server.id)

const openaiTools = tools.map(toOpenAIResponsesTool)
const anthropicTools = tools.map(toAnthropicTool)
```

## Resource Map

| Resource | Purpose |
| --- | --- |
| `client.workspaces` | Workspace management and workspace integrations |
| `client.connections` | Connection CRUD and resolution |
| `client.connect` | Hosted connect session creation, polling, and popup helper |
| `client.actions` | Integration action execution |
| `client.triggers` | Trigger enablement, listing, testing, and disabling |
| `client.mcpServers` | MCP servers, tools, tokens, Code Mode execution, declarations |
| `client.integrations` | Integration metadata, property options, OAuth status |
| `client.endUsers` | End-user identity, connect tokens, invites |
| `client.partials` | Input partial presets and enforced fields |
| `client.approvalPolicies` | Human Gates policy management |
| `client.approvals` | Approval inbox, decisions, and waiting |
| `client.apiKeys` | Customer-facing API key management |

## Error Handling

```typescript
import { WeavzClient, WeavzError } from '@weavz/sdk'

try {
  await client.actions.execute('slack', 'send_channel_message', {
    workspaceId: workspace.id,
    integrationAlias: 'customer_slack',
    input: { channel: '#general', text: 'Hello' },
  })
} catch (error) {
  if (error instanceof WeavzError) {
    console.error(error.code)
    console.error(error.status)
    console.error(error.details)
  } else {
    throw error
  }
}
```

## Publishing And Development

This public repository is a release mirror. SDK development happens in the main Weavz monorepo under `sdks/typescript/`, then this repository is updated from that source directory for releases.

For local checks in this repository:

```bash
npm install
npm run build
npm run typecheck
npm run test:types
```

Live integration tests require a running Weavz API stack.

## License

[MIT](LICENSE)
