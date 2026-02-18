import { WeavzError } from './errors'

// ============================================================================
// Types
// ============================================================================

export interface WeavzClientOptions {
  /** API key (wvz_...) */
  apiKey: string
  /** Base URL of the Weavz API (default: https://api.weavz.io) */
  baseUrl?: string
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number
  /** Maximum number of retries on retryable errors (default: 2, meaning 3 total attempts) */
  maxRetries?: number
}

interface RequestOptions {
  method?: string
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
}

export interface WorkspaceIntegration {
  id: string
  workspaceId: string
  integrationName: string
  alias: string
  connectionStrategy: 'fixed' | 'per_user' | 'per_user_with_fallback'
  connectionId?: string | null
  displayName?: string | null
  enabledActions?: string[] | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface InputPartial {
  id: string
  orgId: string
  workspaceId: string
  integrationName: string
  actionName?: string | null
  name: string
  description?: string | null
  values: Record<string, unknown>
  enforcedKeys: string[]
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Resource Classes
// ============================================================================

class BaseResource {
  constructor(protected client: WeavzClient) {}

  protected _get<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
    return this.client.request<T>(path, { method: 'GET', params })
  }

  protected _post<T>(path: string, body?: unknown) {
    return this.client.request<T>(path, { method: 'POST', body })
  }

  protected _patch<T>(path: string, body?: unknown) {
    return this.client.request<T>(path, { method: 'PATCH', body })
  }

  protected _del<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
    return this.client.request<T>(path, { method: 'DELETE', params })
  }
}

class WorkspacesResource extends BaseResource {
  list() {
    return this._get<{ workspaces: unknown[]; total: number }>('/api/v1/workspaces')
  }
  create(data: { name: string; slug: string }) {
    return this._post<{ workspace: unknown }>('/api/v1/workspaces', data)
  }
  get(id: string) {
    return this._get<{ workspace: unknown }>(`/api/v1/workspaces/${id}`)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/workspaces/${id}`)
  }
  listIntegrations(workspaceId: string) {
    return this._get<{ integrations: WorkspaceIntegration[]; total: number }>(`/api/v1/workspaces/${workspaceId}/integrations`)
  }
  addIntegration(workspaceId: string, data: {
    integrationName: string
    alias?: string
    connectionStrategy?: 'fixed' | 'per_user' | 'per_user_with_fallback'
    connectionId?: string
    displayName?: string
    enabledActions?: string[]
    sortOrder?: number
  }) {
    return this._post<{ integration: WorkspaceIntegration }>(`/api/v1/workspaces/${workspaceId}/integrations`, data)
  }
  updateIntegration(workspaceId: string, id: string, data: {
    alias?: string
    connectionStrategy?: 'fixed' | 'per_user' | 'per_user_with_fallback'
    connectionId?: string | null
    displayName?: string | null
    enabledActions?: string[] | null
    sortOrder?: number
  }) {
    return this._patch<{ integration: WorkspaceIntegration }>(`/api/v1/workspaces/${workspaceId}/integrations/${id}`, data)
  }
  removeIntegration(workspaceId: string, id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/workspaces/${workspaceId}/integrations/${id}`)
  }
}

class ConnectionsResource extends BaseResource {
  list(id?: string) {
    if (id) {
      return this._get<{ connection: unknown }>('/api/v1/connections', { id })
    }
    return this._get<{ connections: unknown[]; total: number }>('/api/v1/connections')
  }
  create(data: {
    type: 'SECRET_TEXT' | 'BASIC_AUTH' | 'CUSTOM_AUTH' | 'OAUTH2' | 'PLATFORM_OAUTH2'
    externalId: string
    displayName: string
    integrationName: string
    workspaceId?: string
    endUserId?: string
    scope?: 'ORGANIZATION' | 'WORKSPACE' | 'USER'
    secretText?: string
    username?: string
    password?: string
    props?: Record<string, unknown>
    accessToken?: string
    refreshToken?: string
    tokenType?: string
    expiresIn?: number
    scope_oauth?: string
    data?: Record<string, unknown>
  }) {
    return this._post<{ connection: unknown }>('/api/v1/connections', data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/connections/${id}`)
  }
  resolve(data: { integrationName: string; workspaceId: string; externalId?: string; endUserId?: string }) {
    return this._post<{ connection: unknown }>('/api/v1/connections/resolve', data)
  }
}

class ConnectResource extends BaseResource {
  /** Create a connect session token for the hosted connect flow */
  createToken(data: {
    integrationName: string
    connectionName: string
    externalId: string
    workspaceId: string
    endUserId?: string
    scope?: 'ORGANIZATION' | 'WORKSPACE' | 'USER'
    successRedirectUri?: string
    errorRedirectUri?: string
  }) {
    return this._post<{ token: string; connectUrl: string; expiresAt: string }>('/api/v1/connect/token', data)
  }
  /** Poll connect session status */
  getSession(sessionId: string) {
    return this._get<{ session: { id: string; integrationName: string; connectionName: string; externalId: string; status: string; connectionId: string | null; error: string | null; expiresAt: string; createdAt: string } }>(`/api/v1/connect/session/${sessionId}`)
  }
  /**
   * Open a popup for the hosted connect flow (browser-only).
   * Resolves with the connection result when complete.
   */
  async popup(options: { token: string; connectUrl: string }): Promise<{ connectionId: string; integrationName: string; externalId: string }> {
    return new Promise((resolve, reject) => {
      const popup = window.open(options.connectUrl, 'weavz-connect', 'width=500,height=600,popup=yes')

      // Fallback: poll for popup close
      const interval = setInterval(() => {
        if (popup?.closed) {
          clearInterval(interval)
          setTimeout(() => {
            window.removeEventListener('message', handler)
            reject(new Error('Popup closed before completing'))
          }, 3000)
        }
      }, 500)

      const handler = (event: MessageEvent) => {
        if (event.data?.type !== 'weavz-connect-result') return
        // Validate origin matches connect URL
        try {
          const expectedOrigin = new URL(options.connectUrl).origin
          if (event.origin && event.origin !== expectedOrigin) return
        } catch { /* ignore URL parse errors */ }
        window.removeEventListener('message', handler)
        clearInterval(interval)

        if (event.data.status === 'error') {
          reject(new Error(event.data.error || 'Connection failed'))
          return
        }

        resolve({
          connectionId: event.data.connectionId,
          integrationName: event.data.integrationName,
          externalId: event.data.externalId,
        })
      }

      window.addEventListener('message', handler)
    })
  }
}

class ActionsResource extends BaseResource {
  execute(integrationName: string, actionName: string, options: {
    workspaceId: string
    input?: Record<string, unknown>
    connectionExternalId?: string
    endUserId?: string
    integrationAlias?: string
    partialIds?: string[]
  }) {
    return this._post<{ output: Record<string, unknown> }>('/api/v1/actions/execute', {
      integrationName,
      actionName,
      input: options.input ?? {},
      connectionExternalId: options.connectionExternalId,
      workspaceId: options.workspaceId,
      endUserId: options.endUserId,
      integrationAlias: options.integrationAlias,
      partialIds: options.partialIds,
    })
  }
}

class TriggersResource extends BaseResource {
  list() {
    return this._get<{ triggers: unknown[]; total: number }>('/api/v1/triggers')
  }
  enable(data: {
    integrationName: string
    triggerName: string
    callbackUrl: string
    workspaceId: string
    callbackHeaders?: Record<string, string>
    callbackMetadata?: Record<string, unknown>
    connectionExternalId?: string
    endUserId?: string
    input?: Record<string, unknown>
    partialIds?: string[]
    simulate?: boolean
  }) {
    return this._post<{ triggerSource: unknown }>('/api/v1/triggers/enable', data)
  }
  disable(triggerSourceId: string) {
    return this._post<{ disabled: boolean; triggerSourceId: string }>('/api/v1/triggers/disable', { triggerSourceId })
  }
  test(integrationName: string, triggerName: string) {
    return this._post<{ sampleData: unknown }>('/api/v1/triggers/test', { integrationName, triggerName })
  }
}

class McpServersResource extends BaseResource {
  list() {
    return this._get<{ servers: unknown[]; total: number }>('/api/v1/mcp/servers')
  }
  create(data: {
    name: string
    workspaceId: string
    description?: string
    createdBy?: string
    mode?: 'TOOLS' | 'CODE'
    endUserId?: string
  }) {
    return this._post<{ server: unknown; bearerToken: string; mcpEndpoint: string }>('/api/v1/mcp/servers', data)
  }
  get(id: string) {
    return this._get<{ server: unknown; tools: unknown[] }>(`/api/v1/mcp/servers/${id}`)
  }
  update(id: string, data: { name?: string; description?: string; mode?: string; endUserId?: string | null }) {
    return this._patch<{ server: unknown }>(`/api/v1/mcp/servers/${id}`, data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/mcp/servers/${id}`)
  }
  regenerateToken(id: string) {
    return this._post<{ bearerToken: string; mcpEndpoint: string }>(`/api/v1/mcp/servers/${id}/regenerate-token`)
  }
  addTool(serverId: string, data: {
    integrationName: string
    actionName: string
    integrationAlias?: string
    toolType?: 'ACTION' | 'TRIGGER'
    connectionId?: string
    displayName?: string
    description?: string
    inputDefaults?: Record<string, unknown>
    partialIds?: string[]
    sortOrder?: number
  }) {
    return this._post<{ tool: unknown }>(`/api/v1/mcp/servers/${serverId}/tools`, data)
  }
  updateTool(serverId: string, toolId: string, data: {
    displayName?: string
    description?: string
    inputDefaults?: Record<string, unknown>
    connectionId?: string
    sortOrder?: number
    integrationAlias?: string
    partialIds?: string[]
  }) {
    return this._patch<{ tool: unknown }>(`/api/v1/mcp/servers/${serverId}/tools/${toolId}`, data)
  }
  deleteTool(serverId: string, toolId: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/mcp/servers/${serverId}/tools/${toolId}`)
  }
  executeCode(serverId: string, code: string) {
    return this._post<{ content: unknown[]; isError: boolean }>(`/api/v1/mcp/servers/${serverId}/execute-code`, { code })
  }
  getDeclarations(serverId: string, integrationOrAlias: string) {
    return this._get<{ declarations: string }>(`/api/v1/mcp/servers/${serverId}/declarations/${integrationOrAlias}`)
  }
  syncFromWorkspace(id: string, data?: {
    aliases?: string[]
    actions?: Record<string, string[]>
  }) {
    return this._post<{ tools: unknown[]; added: number }>(`/api/v1/mcp/servers/${id}/sync-from-workspace`, data)
  }
}

class ApiKeysResource extends BaseResource {
  list() {
    return this._get<{ apiKeys: unknown[]; total: number }>('/api/v1/api-keys')
  }
  create(data: {
    name: string
    expiresAt?: string
    permissions?: { scope: 'org' } | { scope: 'workspace'; workspaceIds: string[] }
  }) {
    return this._post<{ apiKey: unknown; plainKey: string }>('/api/v1/api-keys', data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/api-keys/${id}`)
  }
}

class MembersResource extends BaseResource {
  list() {
    return this._get<{ members: unknown[]; total: number }>('/api/v1/members')
  }
  create(data: { userId: string; role?: 'owner' | 'admin' | 'member' }) {
    return this._post<{ member: unknown }>('/api/v1/members', data)
  }
  update(id: string, data: { role: 'owner' | 'admin' | 'member' }) {
    return this._patch<{ member: unknown }>(`/api/v1/members/${id}`, data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/members/${id}`)
  }
}

class WorkspaceMembersResource extends BaseResource {
  create(data: { workspaceId: string; memberId: string; role?: 'admin' | 'member' }) {
    return this._post<{ workspaceMember: unknown }>('/api/v1/workspace-members', data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/workspace-members/${id}`)
  }
}

class IntegrationsResource extends BaseResource {
  list() {
    return this._get<{ integrations: unknown[]; total: number; registered: string[] }>('/api/v1/integrations')
  }
  get(name: string) {
    return this._get<{ integration: unknown }>('/api/v1/integrations', { name })
  }
  resolveOptions(integrationName: string, data: {
    propertyName: string
    actionName?: string
    triggerName?: string
    connectionExternalId?: string
    workspaceId?: string
    endUserId?: string
    input?: Record<string, unknown>
    searchValue?: string
  }) {
    return this._post<{ options: unknown[]; disabled: boolean }>(`/api/v1/integrations/${integrationName}/properties/options`, data)
  }
  resolveProperty(integrationName: string, data: {
    propertyName: string
    actionName?: string
    triggerName?: string
    connectionExternalId?: string
    workspaceId?: string
    endUserId?: string
    input?: Record<string, unknown>
  }) {
    return this._post<unknown>(`/api/v1/integrations/${integrationName}/properties/resolve`, data)
  }
  oauthStatus() {
    return this._get<{ configured: string[] }>('/api/v1/integrations/oauth-status')
  }
}

class PartialsResource extends BaseResource {
  list(params: { workspaceId: string; integrationName?: string; actionName?: string }) {
    return this._get<{ partials: InputPartial[]; total: number }>('/api/v1/partials', params as Record<string, string | number | boolean | undefined>)
  }
  get(id: string) {
    return this._get<{ partial: InputPartial }>(`/api/v1/partials/${id}`)
  }
  create(data: {
    workspaceId: string
    integrationName: string
    name: string
    actionName?: string | null
    description?: string | null
    values?: Record<string, unknown>
    enforcedKeys?: string[]
    isDefault?: boolean
  }) {
    return this._post<{ partial: InputPartial }>('/api/v1/partials', {
      ...data,
      values: data.values ?? {},
    })
  }
  update(id: string, data: {
    name?: string
    description?: string | null
    values?: Record<string, unknown>
    enforcedKeys?: string[]
    isDefault?: boolean
  }) {
    return this._patch<{ partial: InputPartial }>(`/api/v1/partials/${id}`, data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/partials/${id}`)
  }
  setDefault(id: string, isDefault: boolean) {
    return this._post<{ partial: InputPartial }>(`/api/v1/partials/${id}/set-default`, { isDefault })
  }
}

export interface EndUser {
  id: string
  workspaceId: string
  externalId?: string | null
  displayName?: string | null
  email?: string | null
  metadata?: Record<string, unknown> | null
  connectionCount?: number
  type: 'external' | 'member'
  createdAt: string
  updatedAt: string
}

class EndUsersResource extends BaseResource {
  create(data: {
    workspaceId: string
    externalId: string
    displayName?: string
    email?: string
    metadata?: Record<string, unknown>
  }) {
    return this._post<{ endUser: EndUser }>('/api/v1/end-users', data)
  }
  list(params: { workspaceId: string }) {
    return this._get<{ endUsers: EndUser[]; total: number }>('/api/v1/end-users', params)
  }
  get(id: string) {
    return this._get<{ endUser: EndUser; connections: unknown[] }>(`/api/v1/end-users/${id}`)
  }
  update(id: string, data: {
    displayName?: string | null
    email?: string | null
    metadata?: Record<string, unknown> | null
  }) {
    return this._patch<{ endUser: EndUser }>(`/api/v1/end-users/${id}`, data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/end-users/${id}`)
  }
  createConnectToken(id: string, data?: { integrationName?: string; expiresIn?: number }) {
    return this._post<{ connectUrl: string; token: string; expiresAt: string }>(`/api/v1/end-users/${id}/connect-token`, data)
  }
  invite(id: string, data: { email: string; integrationName?: string; expiresIn?: number }) {
    return this._post<{ sent: boolean; email: string }>(`/api/v1/end-users/${id}/invite`, data)
  }
}

class InvitationsResource extends BaseResource {
  send(data: { email: string; role?: string; organizationId: string }) {
    return this._post<{ invitation: unknown }>('/api/v1/members/invite', data)
  }
  list() {
    return this._get<{ invitations: unknown[]; total: number }>('/api/v1/members/invitations')
  }
  revoke(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/members/invitations/${id}`)
  }
  accept(id: string) {
    return this._post<{ member: unknown }>(`/api/v1/members/invitations/${id}/accept`)
  }
}

// ============================================================================
// Client
// ============================================================================

export class WeavzClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeout: number
  private readonly maxRetries: number

  readonly workspaces: WorkspacesResource
  readonly connections: ConnectionsResource
  readonly connect: ConnectResource
  readonly actions: ActionsResource
  readonly triggers: TriggersResource
  readonly mcpServers: McpServersResource
  readonly apiKeys: ApiKeysResource
  readonly members: MembersResource
  readonly workspaceMembers: WorkspaceMembersResource
  readonly integrations: IntegrationsResource
  readonly partials: PartialsResource
  readonly invitations: InvitationsResource
  readonly endUsers: EndUsersResource

  constructor(options: WeavzClientOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = (options.baseUrl || 'https://api.weavz.io').replace(/\/+$/, '')
    this.timeout = options.timeout ?? 30_000
    this.maxRetries = options.maxRetries ?? 2

    this.workspaces = new WorkspacesResource(this)
    this.connections = new ConnectionsResource(this)
    this.connect = new ConnectResource(this)
    this.actions = new ActionsResource(this)
    this.triggers = new TriggersResource(this)
    this.mcpServers = new McpServersResource(this)
    this.apiKeys = new ApiKeysResource(this)
    this.members = new MembersResource(this)
    this.workspaceMembers = new WorkspaceMembersResource(this)
    this.integrations = new IntegrationsResource(this)
    this.partials = new PartialsResource(this)
    this.invitations = new InvitationsResource(this)
    this.endUsers = new EndUsersResource(this)
  }

  /** Make an authenticated request to the Weavz API */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, params } = options

    let url = `${this.baseUrl}${path}`
    if (params) {
      const searchParams = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) searchParams.set(key, String(value))
      }
      const qs = searchParams.toString()
      if (qs) url += `?${qs}`
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    }

    if (body) {
      headers['Content-Type'] = 'application/json'
    }

    const isIdempotent = method === 'GET' || method === 'PUT' || method === 'DELETE' || method === 'PATCH'

    let lastError: WeavzError | undefined
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.timeout),
      })

      if (response.ok) {
        return response.json() as Promise<T>
      }

      let errorBody: { error?: string; code?: string; details?: unknown } = {}
      try {
        errorBody = await response.json() as typeof errorBody
      } catch {
        // ignore parse errors
      }

      lastError = new WeavzError({
        message: errorBody.error || `HTTP ${response.status}`,
        code: errorBody.code || 'HTTP_ERROR',
        status: response.status,
        details: errorBody.details,
      })

      const is429 = response.status === 429
      const is5xx = response.status >= 500 && response.status < 600
      const shouldRetry = is429 || (is5xx && isIdempotent)

      if (!shouldRetry || attempt >= this.maxRetries) {
        throw lastError
      }

      // Calculate backoff delay
      const retryAfter = response.headers.get('Retry-After')
      let delay: number
      if (retryAfter) {
        const parsed = Number(retryAfter)
        if (!Number.isNaN(parsed)) {
          delay = parsed * 1000
        } else {
          // RFC 7231 date format
          const date = new Date(retryAfter).getTime()
          delay = Math.max(0, date - Date.now())
        }
      } else {
        // Exponential backoff: 500ms, 1000ms, 2000ms, ...
        delay = 500 * Math.pow(2, attempt)
      }

      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    // Should not reach here, but satisfy TypeScript
    throw lastError!
  }
}
