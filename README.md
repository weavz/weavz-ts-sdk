# Weavz TypeScript SDK

[![npm version](https://img.shields.io/npm/v/%40weavz-io%2Fsdk?label=npm)](https://www.npmjs.com/package/@weavz-io/sdk)
[![npm downloads](https://img.shields.io/npm/dm/%40weavz-io%2Fsdk?label=downloads)](https://www.npmjs.com/package/@weavz-io/sdk)
[![GitHub release](https://img.shields.io/github/v/release/weavz/weavz-ts-sdk?label=release)](https://github.com/weavz/weavz-ts-sdk/releases)
[![Release workflow](https://github.com/weavz/weavz-ts-sdk/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/weavz/weavz-ts-sdk/actions/workflows/release.yml)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-3178c6)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/npm/l/%40weavz-io%2Fsdk?label=license)](https://github.com/weavz/weavz-ts-sdk/blob/main/LICENSE)

Official TypeScript SDK for [Weavz](https://weavz.io), governed app access and execution infrastructure for SaaS and AI products.

Weavz gives your product one API for connection management, end-user identity, hosted connect flows, action execution, triggers, MCP servers, approval rules, saved inputs, Filesystem, State KV, Sandbox execution, and 1,000+ integrations.

## Links

- [Weavz](https://weavz.io)
- [Dashboard](https://dashboard.weavz.io)
- [Documentation](https://weavz.io/docs)
- [TypeScript SDK docs](https://weavz.io/docs/sdks/typescript)
- [API reference](https://weavz.io/docs/api-reference)
- [Integration catalog](https://weavz.io/integrations)

## Installation

```bash
npm install @weavz-io/sdk
```

The package ships ESM, CommonJS, and TypeScript declarations. Node.js 18 or later is supported; browser and edge clients need the standard Fetch and AbortController APIs. Keep your API key on a trusted backend. Send a short-lived Hosted Connect URL to the browser when connecting an end user.

```typescript
import { WeavzClient } from '@weavz-io/sdk'

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
- Approval rules for review before selected actions run
- Saved inputs for reusable action values, with optional advanced defaults and locked fields
- Triggers and webhooks that forward integration events into your product

## Quick Start

This example creates a workspace and writes a file to its shared Filesystem. Use end-user scope when files should be private to each user.

```typescript
import { WeavzClient } from '@weavz-io/sdk'

const client = new WeavzClient({
  apiKey: process.env.WEAVZ_API_KEY!,
})

const { workspace } = await client.workspaces.create({
  name: 'Production',
  slug: 'production',
})

await client.workspaces.addIntegration(workspace.id, {
  integrationName: 'storage',
  alias: 'files',
  connectionStrategy: 'fixed',
  settings: { persistence: { scope: 'workspace' } },
})

const result = await client.actions.execute('storage', 'write_file', {
  workspaceId: workspace.id,
  integrationAlias: 'files',
  input: {
    path: 'hello.txt',
    content: 'Hello from Weavz',
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
  baseUrl: 'https://platform.weavz.io',
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
| `baseUrl` | No | `https://platform.weavz.io` | API base URL |
| `timeout` | No | `310000` | Timeout per attempt in milliseconds, including the response body |
| `maxRetries` | No | `2` | Retry count for transient reads and throttled requests. Other mutations are not replayed after network or server failures. |
| `fetch` | No | global `fetch` | Custom fetch implementation |
| `headers` | No | `{}` | Extra headers sent with every request |
| `userAgent` | No | - | User-Agent header value |
| `onRetry` | No | - | Callback before retryable requests are retried |

Retries use exponential backoff and honor `Retry-After`, with a maximum delay of 60 seconds. A caller's abort signal stops the current request and any retry delay. Invalid JSON responses raise `WeavzError` with code `INVALID_RESPONSE`; caller cancellation uses `ABORTED` and request timeouts use `TIMEOUT`.

```typescript
const controller = new AbortController()
const pending = client.request('/api/v1/workspaces', { signal: controller.signal })
// Call controller.abort() when the caller no longer needs the result.
const workspaces = await pending
```

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

On your backend, create a Hosted Connect session when an end user needs to connect Slack, Google, GitHub, or another integration account. Return its short-lived `connectUrl` to the browser.

```typescript
const connectClient = new WeavzClient({
  apiKey: process.env.WEAVZ_API_KEY!,
  headers: { Origin: 'https://app.example.com' },
})
const session = await connectClient.connect.createToken({
  integrationName: 'slack',
  connectionName: 'Acme Slack',
  externalId: 'acme_slack',
  workspaceId: workspace.id,
  endUserId: 'user_123',
})

```

Set `Origin` on the backend client to the exact frontend origin that opens the popup. Choose it from server configuration or an allowlist, so OAuth completion returns to the correct page. Prepare `connectUrl` before the click, then call the standalone helper directly from the browser click handler. No API key is needed in the browser:

```typescript
import { openConnectPopup } from '@weavz-io/sdk'

const connected = await openConnectPopup({ connectUrl })

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

// Store bearerToken securely and provide it only to the intended AI client.
console.log(mcpEndpoint)
```

You can also run Code Mode directly through the SDK:

```typescript
const codeRun = await client.mcpServers.executeCode(server.id, `
  return await weavz.files.write_file({
    path: "summary.json",
    content: JSON.stringify({ status: "ready" })
  })
`)
```

Code Mode responses include `structuredContent.timings` for total execution and per-action latency.
For Agent Browser workflows, batch several browser actions inside one Code Mode script instead of
calling `executeCode()` once per click or screenshot.

Read more:

- [MCP servers](https://weavz.io/docs/concepts/mcp-servers)
- [MCP Code Mode](https://weavz.io/docs/guides/mcp-code-mode)
- [MCP Tool Mode](https://weavz.io/docs/guides/mcp-tool-mode)
- [Weavz MCP App](https://weavz.io/docs/guides/weavz-mcp-app)

### Approval Rules

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

- [Approval rules guide](https://weavz.io/docs/guides/human-gates)
- [Approvals API reference](https://weavz.io/docs/api-reference/approvals)

### Saved Inputs

Saved inputs reuse action values. They are optional and manually selected by default; use advanced locking only when a field must not be overridden. SDK names remain `partials`.

```typescript
const { partial } = await client.partials.create({
  workspaceId: workspace.id,
  integrationName: 'slack',
  actionName: 'send_channel_message',
  integrationAlias: 'customer_slack',
  name: 'Support channel',
  values: { channel: 'C0123456789' },
  enforcedKeys: [],
  isDefault: false,
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
import { integrationActions, integrationNames, isKnownActionName } from '@weavz-io/sdk'
import type {
  ActionInput,
  ActionName,
  IntegrationName,
  SlackSendChannelMessageInput,
} from '@weavz-io/sdk'

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

MCP is the primary hosted agent access path. The SDK also includes dependency-free adapters that convert configured workspace actions into common AI tool shapes.

Adapter tools execute through the action API using your API key. If an action needs approval, configure an optional approval rule for the `sdk` source when using these adapters. Use the MCP endpoint when you need MCP-specific approval policies. Tools created from an MCP server preserve its end-user binding, assigned credential, input defaults, integration alias, and saved inputs. A conflicting credential context or duplicate dispatch name is rejected instead of selecting another account or action.

The OpenAI mappings explicitly use `strict: false` to preserve optional fields and arbitrary JSON inputs from integration metadata. Google function declarations use `parametersJsonSchema` so numeric choices, arrays, nested objects and JSON unions retain their meaning. If you read the former `parameters` field directly, update that access to `parametersJsonSchema`.

```typescript
import {
  createMcpServerActionTools,
  toAnthropicTool,
  toOpenAIResponsesTool,
} from '@weavz-io/sdk'

const tools = await createMcpServerActionTools(client, server.id)

const openaiTools = tools.map(toOpenAIResponsesTool)
const anthropicTools = tools.map(toAnthropicTool)
```

## Skills

Skills store optional reusable task instructions. Search returns metadata; read a selected skill explicitly. Saving instructions does not execute them or grant app access.

```typescript
const library = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  endUserId: 'customer_123',
} as const

const created = await client.skills.create({
  ...library,
  slug: 'customer-call-brief',
  name: 'Prepare a customer call brief',
  markdown: '# Customer call brief\nSummarize the connected records and cite sources.',
})
const matches = await client.skills.search({ ...library, query: 'brief' })
const selected = await client.skills.get(created.skill.id, library)
await client.skills.update(selected.skill.id, {
  ...library,
  expectedVersion: selected.skill.version,
  description: 'Prepare a sourced brief before a customer meeting.',
})
```

For shared instructions, use `{ workspaceId, scope: 'workspace' }` and omit `endUserId`. Sharing requires creating a separate record; an existing skill's owner and scope are immutable. Updates and deletion require the current `expectedVersion` and return `SKILL_CONFLICT` for a stale version. See the [Skills guide](https://weavz.io/docs/guides/skills).

## Human Computer Access

Start and operate computers through [Computer Control actions](https://weavz.io/integrations/computer-control). For an existing session, your application backend can issue a short-lived link for a person to watch or take over.

Authenticate the person and authorize access to that session before issuing a link. Derive the workspace, session and external end-user ID from your application's validated user context. Keep the Weavz API key on your backend.

```typescript
const access = await client.computerSessions.createAccess(
  '7df5c03e-4df5-4b5f-95a7-5277d8f972db',
  {
    workspaceId: '550e8400-e29b-41d4-a716-446655440000',
    endUserId: 'customer_123',
    role: 'watch',
    ttlSeconds: 120,
    frameOrigin: 'https://app.example.com',
  },
)
// Deliver access.viewerUrl privately to the authorized browser.
```

`watch` allows observation. Use `control` for an authorized person to take over through the viewer; it does not grant agent tool control. Request a lifetime of 1–300 seconds; the link expires no later than the computer session. Omit `frameOrigin` when opening the viewer directly; when embedding, provide the exact HTTPS origin without a path or wildcard.

`viewerUrl` is a sensitive credential. Preserve its fragment when opening it, deliver it only to the intended person, and keep it out of logs, analytics and agent or tool context. See the [Computer Control guide](https://weavz.io/docs/guides/computer-control) for setup, embedding and control handoff.

## Resource Map

| Resource | Purpose |
| --- | --- |
| `client.workspaces` | Workspace management and workspace integrations |
| `client.connections` | Connection CRUD and resolution |
| `client.connect` | Hosted connect session creation, polling, and popup helper |
| `client.actions` | Integration action execution |
| `client.triggers` | Trigger enablement, listing, testing, and disabling |
| `client.mcpServers` | MCP servers, tools, tokens, Code Mode execution, declarations |
| `client.skills` | Personal and shared task instructions, metadata search and versioned editing |
| `client.computerSessions` | Short-lived human watch or control links for existing Computer Control sessions |
| `client.integrations` | Integration metadata, property options, OAuth status |
| `client.endUsers` | End-user identity, connect tokens, invites |
| `client.partials` | Saved inputs and enforced fields |
| `client.approvalPolicies` | Approval rule management |
| `client.approvals` | Approval inbox, decisions, and waiting |
| `client.apiKeys` | Customer-facing API key management |

## Error Handling

```typescript
import { WeavzClient, WeavzError } from '@weavz-io/sdk'

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
npm run test:unit
npm test
```

The default test run executes offline unit tests and skips live integration tests. To run integration tests, set `TEST_API_URL` and `TEST_API_KEY` for a disposable test organization with an organization-wide API key. These tests create and delete workspaces, connections, MCP servers, and temporary keys; they do not provision an organization or change your supplied API key.

## License

[MIT](LICENSE)

## Current capabilities in 0.3.0

The 0.3.0 SDK adds the Skills resource for optional, reusable task instructions and `client.computerSessions.createAccess()` for issuing a short-lived human watch or control link to an existing Computer Control session. Skills do not run tasks or grant app access; session access does not start or provision a computer. See [Skills](#skills) and [Human Computer Access](#human-computer-access) for setup and safe handling.

## Migrating to 0.2.0

Google function declarations now use `parametersJsonSchema` rather than `parameters`. Update code that reads the old field directly. Generated response types represent nullable fields accurately; check for null before using optional connection, workspace, and trigger metadata.

Use `openConnectPopup({ connectUrl })` in browser code, with a session URL prepared by your backend. `client.connect.popup()` remains available for compatibility. Concurrent popups remain isolated, and messages must match both the connect origin and the opened window.

MCP-derived adapters preserve the configured user, connection, defaults, and saved input rules. Conflicting bindings and duplicate tool names fail explicitly. Configure a matching binding before creating the tools. Action POST requests are not replayed after ambiguous network or server failures.
