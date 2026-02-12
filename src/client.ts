import { WeavzError } from './errors'

// ============================================================================
// Types
// ============================================================================

export interface WeavzClientOptions {
  /** API key (wvz_...) */
  apiKey: string
  /** Base URL of the Weavz API (default: https://api.weavz.io) */
  baseUrl?: string
}

interface RequestOptions {
  method?: string
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
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

class OrganizationsResource extends BaseResource {
  get(id: string) {
    return this._get<{ org: unknown }>(`/api/v1/orgs/${id}`)
  }
  update(id: string, data: { name?: string; slug?: string }) {
    return this._patch<{ org: unknown }>(`/api/v1/orgs/${id}`, data)
  }
}

class ProjectsResource extends BaseResource {
  list() {
    return this._get<{ projects: unknown[]; total: number }>('/api/v1/projects')
  }
  create(data: { name: string; slug: string }) {
    return this._post<{ project: unknown }>('/api/v1/projects', data)
  }
  get(id: string) {
    return this._get<{ project: unknown }>(`/api/v1/projects/${id}`)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/projects/${id}`)
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
    pieceName: string
    projectId?: string
    userId?: string
    scope?: 'ORGANIZATION' | 'PROJECT' | 'USER'
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
  resolve(data: { pieceName: string; externalId?: string; projectId?: string; userId?: string }) {
    return this._post<{ connection: unknown }>('/api/v1/connections/resolve', data)
  }
}

class OAuthAppsResource extends BaseResource {
  list() {
    return this._get<{ apps: unknown[] }>('/api/v1/oauth-apps')
  }
  create(data: {
    pieceName: string
    clientId: string
    clientSecret: string
    authUrl?: string
    tokenUrl?: string
    scope?: string
    extraParams?: Record<string, string>
  }) {
    return this._post<{ app: unknown }>('/api/v1/oauth-apps', data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/oauth-apps/${id}`)
  }
}

class OAuthResource extends BaseResource {
  authorize(data: {
    pieceName: string
    redirectUrl: string
    connectionName: string
    scope?: string[]
    extraParams?: Record<string, string>
  }) {
    return this._post<{ authorizationUrl: string; state: string; codeVerifier?: string }>('/api/v1/oauth/authorize', data)
  }
  claim(data: {
    pieceName: string
    code: string
    redirectUrl: string
    connectionName: string
    externalId: string
    codeVerifier?: string
  }) {
    return this._post<{ connection: unknown }>('/api/v1/oauth/callback', data)
  }
  refresh(externalId: string) {
    return this._post<{ connection: unknown; refreshed: boolean }>('/api/v1/oauth/refresh', { externalId })
  }
}

class WebhookSecretsResource extends BaseResource {
  list() {
    return this._get<{ secrets: unknown[] }>('/api/v1/webhook-secrets')
  }
  create(data: { pieceName: string; secret: string }) {
    return this._post<{ secret: unknown }>('/api/v1/webhook-secrets', data)
  }
  delete(id: string, pieceName: string) {
    return this._del<{ deleted: boolean; pieceName: string }>(`/api/v1/webhook-secrets/${id}`, { pieceName })
  }
}

class ActionsResource extends BaseResource {
  execute(pieceName: string, actionName: string, options?: {
    input?: Record<string, unknown>
    connectionExternalId?: string
    projectId?: string
    userId?: string
  }) {
    return this._post<{ output: Record<string, unknown> }>('/api/v1/actions/execute', {
      pieceName,
      actionName,
      input: options?.input ?? {},
      connectionExternalId: options?.connectionExternalId,
      projectId: options?.projectId,
      userId: options?.userId,
    })
  }
}

class TriggersResource extends BaseResource {
  list() {
    return this._get<{ triggers: unknown[]; total: number }>('/api/v1/triggers')
  }
  enable(data: {
    pieceName: string
    triggerName: string
    callbackUrl: string
    callbackHeaders?: Record<string, string>
    callbackMetadata?: Record<string, unknown>
    connectionExternalId?: string
    projectId?: string
    userId?: string
    simulate?: boolean
  }) {
    return this._post<{ triggerSource: unknown }>('/api/v1/triggers/enable', data)
  }
  disable(triggerSourceId: string) {
    return this._post<{ disabled: boolean; triggerSourceId: string }>('/api/v1/triggers/disable', { triggerSourceId })
  }
  test(pieceName: string, triggerName: string) {
    return this._post<{ sampleData: unknown }>('/api/v1/triggers/test', { pieceName, triggerName })
  }
}

class McpServersResource extends BaseResource {
  list() {
    return this._get<{ servers: unknown[]; total: number }>('/api/v1/mcp/servers')
  }
  create(data: {
    name: string
    description?: string
    projectId?: string
    createdBy?: string
    sharing?: 'PRIVATE' | 'PROJECT' | 'ORG'
    mode?: 'TOOLS' | 'CODE'
  }) {
    return this._post<{ server: unknown; bearerToken: string; mcpEndpoint: string }>('/api/v1/mcp/servers', data)
  }
  get(id: string) {
    return this._get<{ server: unknown; tools: unknown[] }>(`/api/v1/mcp/servers/${id}`)
  }
  update(id: string, data: { name?: string; description?: string; sharing?: string; mode?: string }) {
    return this._patch<{ server: unknown }>(`/api/v1/mcp/servers/${id}`, data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/mcp/servers/${id}`)
  }
  regenerateToken(id: string) {
    return this._post<{ bearerToken: string; mcpEndpoint: string }>(`/api/v1/mcp/servers/${id}/regenerate-token`)
  }
  addTool(serverId: string, data: {
    pieceName: string
    actionName: string
    pieceAlias?: string
    toolType?: 'ACTION' | 'TRIGGER'
    connectionId?: string
    displayName?: string
    description?: string
    inputDefaults?: Record<string, unknown>
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
    pieceAlias?: string
  }) {
    return this._patch<{ tool: unknown }>(`/api/v1/mcp/servers/${serverId}/tools/${toolId}`, data)
  }
  deleteTool(serverId: string, toolId: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/mcp/servers/${serverId}/tools/${toolId}`)
  }
  executeCode(serverId: string, code: string) {
    return this._post<{ content: unknown[]; isError: boolean }>(`/api/v1/mcp/servers/${serverId}/execute-code`, { code })
  }
  getDeclarations(serverId: string, pieceOrAlias: string) {
    return this._get<{ declarations: string }>(`/api/v1/mcp/servers/${serverId}/declarations/${pieceOrAlias}`)
  }
}

class ApiKeysResource extends BaseResource {
  list() {
    return this._get<{ apiKeys: unknown[]; total: number }>('/api/v1/api-keys')
  }
  create(data: { name: string; expiresAt?: string; permissions?: Record<string, unknown> }) {
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
  create(data: { userId: string; role?: 'OWNER' | 'ADMIN' | 'MEMBER' }) {
    return this._post<{ member: unknown }>('/api/v1/members', data)
  }
  update(id: string, data: { role: 'OWNER' | 'ADMIN' | 'MEMBER' }) {
    return this._patch<{ member: unknown }>(`/api/v1/members/${id}`, data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/members/${id}`)
  }
}

class ProjectMembersResource extends BaseResource {
  create(data: { projectId: string; memberId: string; role?: 'ADMIN' | 'MEMBER' }) {
    return this._post<{ projectMember: unknown }>('/api/v1/project-members', data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/project-members/${id}`)
  }
}

class ConnectionPoliciesResource extends BaseResource {
  list() {
    return this._get<{ policies: unknown[]; total: number }>('/api/v1/connection-policies')
  }
  create(data: {
    pieceName: string
    policy: 'ENFORCED_ORG' | 'ENFORCED_PROJECT' | 'USER_REQUIRED' | 'USER_WITH_DEFAULT'
    projectId?: string
    connectionId?: string
  }) {
    return this._post<{ policy: unknown }>('/api/v1/connection-policies', data)
  }
  update(id: string, data: { policy?: string; connectionId?: string }) {
    return this._patch<{ policy: unknown }>(`/api/v1/connection-policies/${id}`, data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/connection-policies/${id}`)
  }
}

class PiecesResource extends BaseResource {
  list() {
    return this._get<{ pieces: unknown[]; total: number; registered: string[] }>('/api/v1/pieces')
  }
  get(name: string) {
    return this._get<{ piece: unknown }>('/api/v1/pieces', { name })
  }
  resolveOptions(pieceName: string, data: {
    propertyName: string
    actionName?: string
    triggerName?: string
    connectionExternalId?: string
    projectId?: string
    userId?: string
    input?: Record<string, unknown>
    searchValue?: string
  }) {
    return this._post<{ options: unknown[]; disabled: boolean }>(`/api/v1/pieces/${pieceName}/properties/options`, data)
  }
  resolveProperty(pieceName: string, data: {
    propertyName: string
    actionName?: string
    triggerName?: string
    connectionExternalId?: string
    projectId?: string
    userId?: string
    input?: Record<string, unknown>
  }) {
    return this._post<unknown>(`/api/v1/pieces/${pieceName}/properties/resolve`, data)
  }
  oauthStatus() {
    return this._get<{ configured: string[] }>('/api/v1/pieces/oauth-status')
  }
}

class FilesResource extends BaseResource {
  getUrl(key: string) {
    return this._get<{ url: string }>('/api/v1/files', { key })
  }
}

class BillingResource extends BaseResource {
  plans() {
    return this._get<{ plans: unknown[] }>('/api/v1/billing/plans')
  }
  plan() {
    return this._get<{ plan: string; limits: unknown; subscription: unknown; billingEnabled: boolean }>('/api/v1/billing/plan')
  }
  usage() {
    return this._get<{ usage: unknown; resources: unknown; limits: unknown; plan: string }>('/api/v1/billing/usage')
  }
  addons() {
    return this._get<{ addons: unknown[] }>('/api/v1/billing/addons')
  }
  purchaseAddon(addonId: string) {
    return this._post<{ success: boolean; addon: unknown; message: string }>('/api/v1/billing/addons/purchase', { addonId })
  }
}

class ActivityResource extends BaseResource {
  list(params?: { limit?: number; offset?: number; type?: string; pieceName?: string; since?: string }) {
    return this._get<{ events: unknown[]; total: number }>('/api/v1/activity', params as Record<string, string | number | boolean | undefined>)
  }
}

// ============================================================================
// Client
// ============================================================================

export class WeavzClient {
  private readonly apiKey: string
  private readonly baseUrl: string

  readonly organizations: OrganizationsResource
  readonly projects: ProjectsResource
  readonly connections: ConnectionsResource
  readonly oauthApps: OAuthAppsResource
  readonly oauth: OAuthResource
  readonly webhookSecrets: WebhookSecretsResource
  readonly actions: ActionsResource
  readonly triggers: TriggersResource
  readonly mcpServers: McpServersResource
  readonly apiKeys: ApiKeysResource
  readonly members: MembersResource
  readonly projectMembers: ProjectMembersResource
  readonly connectionPolicies: ConnectionPoliciesResource
  readonly pieces: PiecesResource
  readonly files: FilesResource
  readonly billing: BillingResource
  readonly activity: ActivityResource

  constructor(options: WeavzClientOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = (options.baseUrl || 'https://api.weavz.io').replace(/\/+$/, '')

    this.organizations = new OrganizationsResource(this)
    this.projects = new ProjectsResource(this)
    this.connections = new ConnectionsResource(this)
    this.oauthApps = new OAuthAppsResource(this)
    this.oauth = new OAuthResource(this)
    this.webhookSecrets = new WebhookSecretsResource(this)
    this.actions = new ActionsResource(this)
    this.triggers = new TriggersResource(this)
    this.mcpServers = new McpServersResource(this)
    this.apiKeys = new ApiKeysResource(this)
    this.members = new MembersResource(this)
    this.projectMembers = new ProjectMembersResource(this)
    this.connectionPolicies = new ConnectionPoliciesResource(this)
    this.pieces = new PiecesResource(this)
    this.files = new FilesResource(this)
    this.billing = new BillingResource(this)
    this.activity = new ActivityResource(this)
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

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      let errorBody: { error?: string; code?: string; details?: unknown } = {}
      try {
        errorBody = await response.json() as typeof errorBody
      } catch {
        // ignore parse errors
      }
      throw new WeavzError({
        message: errorBody.error || `HTTP ${response.status}`,
        code: errorBody.code || 'HTTP_ERROR',
        status: response.status,
        details: errorBody.details,
      })
    }

    return response.json() as Promise<T>
  }

  /** Health check */
  async health() {
    return this.request<{ status: string }>('/health')
  }
}
