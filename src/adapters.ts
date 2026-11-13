import type { Connection, IntegrationMetadata, McpServerTool } from './generated'
import type { ActionExecuteResult, WeavzClient } from './client'

export type JsonSchema = {
  type: string
  properties?: Record<string, unknown>
  required?: string[]
  [key: string]: unknown
}

export interface WeavzActionTool {
  name: string
  description: string
  inputSchema: JsonSchema
  integrationName: string
  actionName: string
  integrationAlias?: string
  execute: (input: Record<string, unknown>) => Promise<ActionExecuteResult>
}

export interface WeavzActionToolOptions {
  integrationName: string
  actionName: string
  workspaceId: string
  integrationAlias?: string
  connectionExternalId?: string
  endUserId?: string
  partialIds?: string[]
  authMethodKey?: string
  inputDefaults?: Record<string, unknown>
  name?: string
  description?: string
  metadata?: IntegrationMetadata
}

type IntegrationAction = {
  displayName?: string
  description?: string
  props?: Record<string, IntegrationProperty>
}

type IntegrationProperty = {
  type?: string
  displayName?: string
  description?: string
  required?: boolean
  refreshers?: string[]
  options?: { options?: Array<{ label?: string; value: unknown }> }
  properties?: Record<string, IntegrationProperty>
}

function safeToolName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^([^a-zA-Z_])/, '_$1')
    .slice(0, 64)
}

function mapPropertyType(type: string | undefined): string | string[] {
  switch (type) {
    case 'NUMBER':
      return 'number'
    case 'CHECKBOX':
      return 'boolean'
    case 'ARRAY':
    case 'STATIC_MULTI_SELECT_DROPDOWN':
    case 'MULTI_SELECT_DROPDOWN':
      return 'array'
    case 'JSON':
      return ['object', 'array', 'string', 'number', 'boolean', 'null']
    case 'FILE':
      return ['string', 'object']
    case 'DYNAMIC':
    case 'OBJECT':
    case 'CUSTOM_AUTH':
    case 'OAUTH2':
      return 'object'
    default:
      return 'string'
  }
}

export function propsToJsonSchema(props: Record<string, IntegrationProperty> = {}): JsonSchema {
  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const [name, prop] of Object.entries(props)) {
    const schema: Record<string, unknown> = {
      type: mapPropertyType(prop.type),
      description: prop.description || prop.displayName || name,
    }

    if (prop.refreshers?.length) {
      schema.description = `${schema.description}. Depends on: ${prop.refreshers.join(', ')}.`
    }

    const values = prop.options?.options?.length ? prop.options.options.map(option => option.value) : undefined
    if (schema.type === 'array') {
      // Generic arrays may contain objects or primitive values. Static choices
      // constrain each selected item, not the entire array value.
      schema.items = values ? enumSchema(values) : prop.properties ? propsToJsonSchema(prop.properties) : {}
    } else if (values) {
      Object.assign(schema, enumSchema(values))
    } else if (schema.type === 'object' && prop.properties) {
      Object.assign(schema, propsToJsonSchema(prop.properties))
    }

    properties[name] = schema
    if (prop.required) required.push(name)
  }

  return { type: 'object', properties, required }
}

export async function createActionTool(client: WeavzClient, options: WeavzActionToolOptions): Promise<WeavzActionTool> {
  const metadata = options.metadata ?? (await client.integrations.get(options.integrationName)).integration
  const action = metadata.actions[options.actionName] as IntegrationAction | undefined
  if (!action) throw new Error(`Action not found: ${options.integrationName}/${options.actionName}`)

  const name = safeToolName(options.name || `${options.integrationAlias || options.integrationName}__${options.actionName}`)
  const description = options.description || action.description || `${metadata.displayName}: ${action.displayName || options.actionName}`
  const inputSchema = propsToJsonSchema(action.props || {})

  return {
    name,
    description,
    inputSchema,
    integrationName: options.integrationName,
    actionName: options.actionName,
    integrationAlias: options.integrationAlias,
    execute: (input: Record<string, unknown>) => client.actions.execute(options.integrationName, options.actionName, {
      workspaceId: options.workspaceId,
      input: { ...options.inputDefaults, ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) },
      connectionExternalId: options.connectionExternalId,
      authMethodKey: options.authMethodKey,
      endUserId: options.endUserId,
      integrationAlias: options.integrationAlias,
      partialIds: options.partialIds,
    }),
  }
}

export async function createMcpServerActionTools(client: WeavzClient, serverId: string): Promise<WeavzActionTool[]> {
  const { server, tools } = await client.mcpServers.get(serverId)
  if (!server.workspaceId) {
    throw new Error('Adapter tools require an MCP server scoped to a workspace')
  }

  const metadataByIntegration = new Map<string, IntegrationMetadata>()
  const connectionsById = new Map<string, Connection>()
  const actionTools: WeavzActionTool[] = []

  for (const tool of tools as McpServerTool[]) {
    if (tool.toolType !== 'ACTION') continue
    if (!metadataByIntegration.has(tool.integrationName)) {
      metadataByIntegration.set(tool.integrationName, (await client.integrations.get(tool.integrationName)).integration)
    }
    let connection: Connection | undefined
    if (tool.connectionId) {
      if (!connectionsById.has(tool.connectionId)) connectionsById.set(tool.connectionId, (await client.connections.get(tool.connectionId)).connection)
      connection = connectionsById.get(tool.connectionId)!
      if (connection.integrationName !== tool.integrationName) throw new Error('A tool connection must match its integration')
      if (!server.endUserId && connection.endUserId) throw new Error('An end-user connection requires an MCP server bound to that end user')
      if (connection.workspaceId && connection.workspaceId !== server.workspaceId) throw new Error('A tool connection must belong to the MCP server workspace')
      if (server.endUserId && connection.endUserId && connection.endUserId !== server.endUserId) throw new Error('A tool connection must match the MCP server end user')
    }
    actionTools.push(await createActionTool(client, {
      integrationName: tool.integrationName,
      actionName: tool.actionName,
      workspaceId: server.workspaceId,
      integrationAlias: tool.integrationAlias,
      connectionExternalId: connection?.externalId,
      authMethodKey: connection?.authMethodKey ?? undefined,
      endUserId: server.endUserId ?? undefined,
      inputDefaults: tool.inputDefaults ?? undefined,
      partialIds: (tool.partialIds || undefined) as string[] | undefined,
      name: `${tool.integrationAlias || tool.integrationName}__${tool.actionName}`,
      description: tool.description || undefined,
      metadata: metadataByIntegration.get(tool.integrationName),
    }))
  }

  assertUniqueToolNames(actionTools)
  return actionTools
}

export function toOpenAIResponsesTool(tool: WeavzActionTool) {
  return {
    type: 'function' as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
    strict: false,
  }
}

export function toOpenAIChatTool(tool: WeavzActionTool) {
  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
      strict: false,
    },
  }
}

export function toAnthropicTool(tool: WeavzActionTool) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }
}

export function toGoogleFunctionDeclaration(tool: WeavzActionTool) {
  return {
    name: tool.name,
    description: tool.description,
    parametersJsonSchema: tool.inputSchema,
  }
}

export function toGoogleFunctionDeclarations(tools: WeavzActionTool[]) {
  return tools.map(toGoogleFunctionDeclaration)
}

function actionToolOutput(result: ActionExecuteResult): unknown {
  return 'output' in result ? result.output : result
}

function enumSchema(values: unknown[]): Record<string, unknown> {
  const types = new Set(values.map(value => value === null ? 'null' : typeof value))
  const type = types.size === 1 ? [...types][0] : undefined
  return { enum: values, ...(type && ['string', 'number', 'boolean', 'null'].includes(type) ? { type } : {}) }
}

function assertUniqueToolNames(tools: WeavzActionTool[]) {
  const names = new Set<string>()
  for (const tool of tools) {
    if (names.has(tool.name)) throw new Error(`Duplicate tool name: ${tool.name}`)
    names.add(tool.name)
  }
}

export function toVercelAIToolSet(
  tools: WeavzActionTool[],
  helpers?: {
    tool?: (definition: { description: string; inputSchema: unknown; execute: (input: Record<string, unknown>) => Promise<unknown> }) => unknown
    jsonSchema?: (schema: JsonSchema) => unknown
  },
) {
  assertUniqueToolNames(tools)
  return Object.fromEntries(tools.map(tool => [
    tool.name,
    helpers?.tool
      ? helpers.tool({
        description: tool.description,
        inputSchema: helpers.jsonSchema ? helpers.jsonSchema(tool.inputSchema) : tool.inputSchema,
        execute: async (input: Record<string, unknown>) => actionToolOutput(await tool.execute(input)),
      })
      : {
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: async (input: Record<string, unknown>) => actionToolOutput(await tool.execute(input)),
      },
  ]))
}

export function toLangChainToolLike(tool: WeavzActionTool) {
  return {
    name: tool.name,
    description: tool.description,
    schema: tool.inputSchema,
    func: async (input: Record<string, unknown>) => JSON.stringify(actionToolOutput(await tool.execute(input))),
  }
}

export function createToolExecutor(tools: WeavzActionTool[]) {
  assertUniqueToolNames(tools)
  const byName = new Map(tools.map(tool => [tool.name, tool]))
  return async (name: string, input: Record<string, unknown>) => {
    const tool = byName.get(name)
    if (!tool) throw new Error(`Unknown tool: ${name}`)
    return tool.execute(input)
  }
}
