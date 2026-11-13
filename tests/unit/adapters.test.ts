import { describe, expect, it, vi } from 'vitest'
import { WeavzClient } from '../../src/client'
import { createActionTool, createMcpServerActionTools, createToolExecutor, propsToJsonSchema, toAnthropicTool, toGoogleFunctionDeclaration, toLangChainToolLike, toOpenAIChatTool, toOpenAIResponsesTool, toVercelAIToolSet, type WeavzActionTool } from '../../src/adapters'

const metadata = { name: 'example', displayName: 'Example', actions: { send: { displayName: 'Send', props: { text: { type: 'SHORT_TEXT', required: true }, channel: { type: 'SHORT_TEXT', required: false } } } } }
const tool = (name = 'example_send'): WeavzActionTool => ({ name, description: 'Send a message', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }, integrationName: 'example', actionName: 'send', execute: vi.fn(async () => ({ success: true, output: 'sent', duration: 1 })) })

function mockClient(options: { tools?: object[]; server?: object; connection?: object } = {}) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const p = new URL(url).pathname
    if (p === '/api/v1/mcp/servers/server') return Response.json({ server: { workspaceId: 'workspace', endUserId: 'customer', ...options.server }, tools: options.tools ?? [{ integrationName: 'example', actionName: 'send', integrationAlias: 'support', toolType: 'ACTION', connectionId: 'connection', partialIds: ['partial'], inputDefaults: { channel: 'support', text: 'default' } }] })
    if (p === '/api/v1/connections') return Response.json({ connection: { integrationName: 'example', externalId: 'selected-account', authMethodKey: 'api_key', workspaceId: 'workspace', endUserId: 'customer', ...options.connection } })
    if (p === '/api/v1/integrations') return Response.json({ integration: metadata })
    if (p === '/api/v1/actions/execute') return Response.json({ success: true, output: JSON.parse(init!.body as string), duration: 1 })
    throw new Error(`Unexpected test request: ${p}`)
  })
  return { client: new WeavzClient({ apiKey: 'wvz_example', fetch: fetch as typeof globalThis.fetch }), fetch }
}

describe('metadata schemas', () => {
  it('constrains each static multiselect item and supplies items for general arrays', () => {
    const schema = propsToJsonSchema({ labels: { type: 'STATIC_MULTI_SELECT_DROPDOWN', required: true, options: { options: [{ value: 'a' }, { value: 'b' }] } }, records: { type: 'ARRAY' } })
    expect(schema.properties).toEqual({ labels: { type: 'array', description: 'labels', items: { type: 'string', enum: ['a', 'b'] } }, records: { type: 'array', description: 'records', items: {} } })
    expect(schema.required).toEqual(['labels'])
  })

  it('does not declare numeric or boolean dropdown values as strings', () => {
    const schema = propsToJsonSchema({ count: { type: 'STATIC_DROPDOWN', options: { options: [{ value: 1 }, { value: 2 }] } }, flag: { type: 'STATIC_DROPDOWN', options: { options: [{ value: true }] } } })
    expect(schema.properties).toMatchObject({ count: { type: 'number', enum: [1, 2] }, flag: { type: 'boolean', enum: [true] } })
  })

  it('preserves arbitrary JSON, inline files, dynamic objects and nested array fields', () => {
    const schema = propsToJsonSchema({ json: { type: 'JSON' }, file: { type: 'FILE' }, dynamic: { type: 'DYNAMIC' }, rows: { type: 'ARRAY', properties: { title: { type: 'SHORT_TEXT', required: true }, details: { type: 'OBJECT', properties: { amount: { type: 'NUMBER' } } } } } })
    expect(schema.properties).toMatchObject({
      json: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'] },
      file: { type: ['string', 'object'] },
      dynamic: { type: 'object' },
      rows: {
        type: 'array',
        items: {
          type: 'object', required: ['title'],
          properties: {
            title: { type: 'string' },
            details: { type: 'object', properties: { amount: { type: 'number' } } },
          },
        },
      },
    })
    const action = tool(); action.inputSchema = schema
    const google = toGoogleFunctionDeclaration(action)
    expect(google.parametersJsonSchema).toBe(schema)
    expect(google).not.toHaveProperty('parameters')
    expect((google.parametersJsonSchema.properties!.json as any).type).toContain('null')
  })

  it('does not produce an impossible enum for unresolved choices', () => {
    expect(propsToJsonSchema({ channel: { type: 'DROPDOWN', options: { options: [] } } }).properties).toEqual({ channel: { type: 'string', description: 'channel' } })
  })
})

describe('action execution context', () => {
  it('preserves MCP server end user, explicit credential, auth method, defaults, alias and partials', async () => {
    const { client } = mockClient()
    const tools = await createMcpServerActionTools(client, 'server')
    expect(tools[0].inputSchema.required).toEqual([])
    const result = await tools[0].execute({ text: 'caller' })
    expect(await tools[0].execute({ text: undefined })).toMatchObject({ output: { input: { text: 'default' } } })
    expect(result).toMatchObject({ output: { workspaceId: 'workspace', endUserId: 'customer', connectionExternalId: 'selected-account', authMethodKey: 'api_key', integrationAlias: 'support', partialIds: ['partial'], input: { channel: 'support', text: 'caller' } } })
  })

  it('reuses integration metadata and connection lookups for repeated configured tools', async () => {
    const { client, fetch } = mockClient({ tools: ['one', 'two'].map(alias => ({ integrationName: 'example', actionName: 'send', integrationAlias: alias, toolType: 'ACTION', connectionId: 'connection' })) })
    expect(await createMcpServerActionTools(client, 'server')).toHaveLength(2)
    expect(fetch.mock.calls.filter(([url]) => new URL(url).pathname === '/api/v1/integrations')).toHaveLength(1)
    expect(fetch.mock.calls.filter(([url]) => new URL(url).pathname === '/api/v1/connections')).toHaveLength(1)
  })

  it('requires an explicit server binding for an end-user credential', async () => {
    const { client } = mockClient({ server: { endUserId: null } })
    await expect(createMcpServerActionTools(client, 'server')).rejects.toThrow('requires an MCP server bound')
  })

  it.each([{ workspaceId: 'different' }, { endUserId: 'different' }, { integrationName: 'different' }])('rejects a credential that cannot be represented in the server context: %j', async connection => {
    const { client } = mockClient({ connection })
    await expect(createMcpServerActionTools(client, 'server')).rejects.toThrow(/must/)
  })

  it('honors direct action-tool caller context and defaults', async () => {
    const { client } = mockClient()
    const action = await createActionTool(client, { integrationName: 'example', actionName: 'send', workspaceId: 'workspace', connectionExternalId: 'selected', endUserId: 'customer', authMethodKey: 'api_key', inputDefaults: { channel: 'support' }, metadata: metadata as never })
    expect(await action.execute({ text: 'hello' })).toMatchObject({ output: { input: { channel: 'support', text: 'hello' }, connectionExternalId: 'selected', endUserId: 'customer', authMethodKey: 'api_key' } })
  })

  it('requires only metadata inputs not supplied by configured defaults', async () => {
    const { client } = mockClient()
    const actionMetadata = {
      ...metadata,
      actions: { send: { props: {
        text: { type: 'SHORT_TEXT', required: true },
        channel: { type: 'SHORT_TEXT', required: true },
        count: { type: 'NUMBER', required: true },
        active: { type: 'CHECKBOX', required: true },
        json: { type: 'JSON', required: true },
        unset: { type: 'SHORT_TEXT', required: true },
        inherited: { type: 'SHORT_TEXT', required: true },
      } } },
    }
    const inputDefaults = Object.assign(Object.create({ inherited: 'not-an-own-default' }), {
      text: 'configured-value', channel: '', count: 0, active: false, json: null, unset: undefined,
    })
    const action = await createActionTool(client, { integrationName: 'example', actionName: 'send', workspaceId: 'workspace', inputDefaults, metadata: actionMetadata as never })

    expect(action.inputSchema.required).toEqual(['unset', 'inherited'])
    expect(Object.keys(action.inputSchema.properties!)).toEqual(Object.keys(actionMetadata.actions.send.props))
    expect(JSON.stringify(action.inputSchema)).not.toContain('configured-value')
    expect(Object.values(actionMetadata.actions.send.props).every(prop => prop.required)).toBe(true)
    expect(await action.execute({ text: 'caller', channel: undefined, unset: 'supplied', inherited: 'supplied' })).toMatchObject({
      output: { input: { text: 'caller', channel: '', count: 0, active: false, json: null, unset: 'supplied', inherited: 'supplied' } },
    })
  })
})

describe('framework mappings', () => {
  it('preserves optional and opaque inputs in OpenAI schemas explicitly', () => {
    expect(toOpenAIResponsesTool(tool())).toMatchObject({ type: 'function', strict: false, parameters: tool().inputSchema })
    expect(toOpenAIChatTool(tool())).toMatchObject({ function: { strict: false, parameters: tool().inputSchema } })
    expect(toAnthropicTool(tool())).toMatchObject({ input_schema: tool().inputSchema })
    expect(toGoogleFunctionDeclaration(tool())).toEqual({ name: tool().name, description: tool().description, parametersJsonSchema: tool().inputSchema })
  })

  it('keeps approval-required results instead of dropping their continuation', async () => {
    const action = tool()
    action.execute = vi.fn(async () => ({ success: false, approval: { id: 'approval' } } as never))
    expect(await (toVercelAIToolSet([action])[action.name] as any).execute({})).toEqual({ success: false, approval: { id: 'approval' } })
    expect(JSON.parse(await toLangChainToolLike(action).func({}))).toEqual({ success: false, approval: { id: 'approval' } })
  })

  it('rejects duplicate dispatch names instead of silently selecting another action', () => {
    expect(() => createToolExecutor([tool(), tool()])).toThrow('Duplicate tool name')
    expect(() => toVercelAIToolSet([tool(), tool()])).toThrow('Duplicate tool name')
  })

  it('rejects collisions caused by sanitizing or truncating MCP tool names', async () => {
    const { client } = mockClient({ tools: ['a'.repeat(65) + 'one', 'a'.repeat(65) + 'two'].map(alias => ({ integrationName: 'example', actionName: 'send', integrationAlias: alias, toolType: 'ACTION' })) })
    await expect(createMcpServerActionTools(client, 'server')).rejects.toThrow('Duplicate tool name')
  })
})
