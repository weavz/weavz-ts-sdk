import { WeavzError } from './errors'
import type {
  ApiKey,
  ApprovalDecisionResult,
  ApprovalPolicy,
  ApprovalPolicyInput,
  ApprovalRequest,
  ApprovalRequiredResult,
  Connection,
  AdvancedCodeWorkspaceSettings as GeneratedAdvancedCodeWorkspaceSettings,
  EndUser as GeneratedEndUser,
  InputPartial as GeneratedInputPartial,
  IntegrationMetadata,
  McpServer,
  McpServerTool,
  TriggerSource,
  Workspace,
  WorkspaceIntegration as GeneratedWorkspaceIntegration,
  WorkspaceIntegrationSettings as GeneratedWorkspaceIntegrationSettings,
} from './generated'
import type {
  ActionInput,
  ActionName,
  ActionPropertyName,
  IntegrationName,
} from './integrations'

// ============================================================================
// Types
// ============================================================================

export interface WeavzClientOptions {
  /** API key (wvz_...) */
  apiKey: string
  /** Base URL of the Weavz API (default: https://platform.weavz.io) */
  baseUrl?: string
  /** Request timeout in milliseconds (default: 310000) */
  timeout?: number
  /** Maximum number of retries on retryable errors (default: 2, meaning 3 total attempts) */
  maxRetries?: number
  /** Custom fetch implementation, useful for tests, edge runtimes, or instrumented clients */
  fetch?: typeof fetch
  /** Extra headers to send with every request */
  headers?: Record<string, string>
  /** User-Agent header value for Node-compatible runtimes */
  userAgent?: string
  /** Called before a retryable request is retried */
  onRetry?: (context: { attempt: number; delayMs: number; error: WeavzError }) => void
}

interface RequestOptions {
  method?: string
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
  signal?: AbortSignal
}

export type WorkspaceIntegration = GeneratedWorkspaceIntegration
export type WorkspaceIntegrationSettings = GeneratedWorkspaceIntegrationSettings
export type AdvancedCodeWorkspaceSettings = GeneratedAdvancedCodeWorkspaceSettings
export type AdvancedCodeSandboxPersistence = NonNullable<AdvancedCodeWorkspaceSettings['sandboxPersistence']>
export type AdvancedCodeStorageMountScope = NonNullable<AdvancedCodeWorkspaceSettings['storageMountScope']>
export type PersistenceWorkspaceSettings = NonNullable<WorkspaceIntegrationSettings['persistence']>
export type PersistenceScope = NonNullable<PersistenceWorkspaceSettings['scope']>
export type InputPartial = GeneratedInputPartial
export type EndUser = GeneratedEndUser
export type ConnectionType = 'SECRET_TEXT' | 'BASIC_AUTH' | 'CUSTOM_AUTH' | 'OAUTH2' | 'PLATFORM_OAUTH2'
export type ConnectionScope = 'ORGANIZATION' | 'WORKSPACE' | 'USER'
export type ConnectionStrategy = 'fixed' | 'per_user' | 'per_user_with_fallback'
export type OAuthAppMode = 'weavz_managed' | 'custom'
export type McpAuthMode = 'oauth' | 'bearer' | 'oauth_and_bearer'
export type McpEndUserAccess = 'restricted' | 'open'
export type McpMode = 'TOOLS' | 'CODE'
export interface McpServerSettings {
  codeMode?: {
    approvalWaitSeconds?: number
  }
  mcpApp?: {
    enabled?: boolean
  }
}
export type McpCodeExecutionInput = string | (({ code: string } | { approvalId: string }) & { waitForApprovalSeconds?: number })
export interface McpAccessTokenResponse {
  accessToken: string
  bearerToken: string
  token: {
    id: string
    tokenPrefix: string
    scopes: string[]
    endUserId: string
    authMethod: 'bearer'
    tokenType: 'mcp_bearer'
    expiresAt: string
    createdAt: string
  }
  mcpEndpoint: string
}

export interface ListOptions {
  [key: string]: string | number | boolean | undefined
  limit?: number
  offset?: number
  includeSuspended?: boolean
}

export interface ActionExecutionResult<Output = unknown> {
  success: boolean
  output: Output
  duration: number
}
export type ActionExecuteResult<Output = unknown> = ActionExecutionResult<Output> | ApprovalRequiredResult

export interface IntegrationSummary {
  name: string
  displayName: string
  description: string
  logoUrl: string
  auth: { type: string } | null
  authOptions?: Array<{ key: string; type: string; displayName: string }>
  categories: string[]
  actionCount: number
  triggerCount: number
}

type KnownIntegrationName = IntegrationName
type KnownActionName<I extends KnownIntegrationName> = ActionName<I>
type KnownActionInput<
  I extends KnownIntegrationName,
  A extends KnownActionName<I>,
> = ActionInput<I, A>
type KnownActionPropertyName<
  I extends KnownIntegrationName,
  A extends KnownActionName<I>,
> = ActionPropertyName<I, A>

export interface ExecuteActionOptions<Input = Record<string, unknown>> {
  workspaceId: string
  input?: Input
  connectionExternalId?: string
  authMethodKey?: string
  workspaceIntegrationId?: string
  endUserId?: string
  integrationAlias?: string
  partialIds?: string[]
  idempotencyKey?: string
}

export interface ResolveActionPropertyOptions<
  I extends KnownIntegrationName,
  A extends KnownActionName<I>,
> {
  propertyName: KnownActionPropertyName<I, A>
  actionName: A
  triggerName?: never
  connectionExternalId?: string
  authMethodKey?: string
  workspaceId?: string
  workspaceIntegrationId?: string
  integrationAlias?: string
  endUserId?: string
  input?: Partial<KnownActionInput<I, A>>
  partialIds?: string[]
  searchValue?: string
}

export interface ResolvePropertyOptions {
  propertyName: string
  actionName?: string
  triggerName?: string
  connectionExternalId?: string
  authMethodKey?: string
  workspaceId?: string
  workspaceIntegrationId?: string
  integrationAlias?: string
  endUserId?: string
  input?: Record<string, unknown>
  partialIds?: string[]
  searchValue?: string
}

// ============================================================================
// Resource Classes
// ============================================================================

class BaseResource {
  constructor(protected client: WeavzClient) {}

  protected _get<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
    return this.client.request<T>(path, { method: 'GET', params })
  }

  protected _post<T>(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.client.request<T>(path, { method: 'POST', body, headers })
  }

  protected _patch<T>(path: string, body?: unknown) {
    return this.client.request<T>(path, { method: 'PATCH', body })
  }

  protected _del<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
    return this.client.request<T>(path, { method: 'DELETE', params })
  }
}

class WorkspacesResource extends BaseResource {
  list(params?: ListOptions) {
    return this._get<{ workspaces: Workspace[]; total: number }>('/api/v1/workspaces', params)
  }
  create(data: { name: string; slug: string }) {
    return this._post<{ workspace: Workspace }>('/api/v1/workspaces', data)
  }
  get(id: string) {
    return this._get<{ workspace: Workspace }>(`/api/v1/workspaces/${id}`)
  }
  update(id: string, data: { name?: string; slug?: string }) {
    return this._patch<{ workspace: Workspace }>(`/api/v1/workspaces/${id}`, data)
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
    connectionStrategy?: ConnectionStrategy
    authMethodKey?: string
    oauthAppMode?: OAuthAppMode
    oauthAppId?: string
    connectionId?: string
    displayName?: string
    enabledActions?: string[]
    settings?: WorkspaceIntegrationSettings
    sortOrder?: number
  }) {
    return this._post<{ integration: WorkspaceIntegration }>(`/api/v1/workspaces/${workspaceId}/integrations`, data)
  }
  updateIntegration(workspaceId: string, id: string, data: {
    alias?: string
    connectionStrategy?: ConnectionStrategy
    authMethodKey?: string
    oauthAppMode?: OAuthAppMode | null
    oauthAppId?: string | null
    connectionId?: string | null
    displayName?: string | null
    enabledActions?: string[] | null
    settings?: WorkspaceIntegrationSettings | null
    sortOrder?: number
  }) {
    return this._patch<{ integration: WorkspaceIntegration }>(`/api/v1/workspaces/${workspaceId}/integrations/${id}`, data)
  }
  removeIntegration(workspaceId: string, id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/workspaces/${workspaceId}/integrations/${id}`)
  }
}

class ConnectionsResource extends BaseResource {
  list(id?: string): Promise<{ connection: Connection }>
  list(params?: ListOptions): Promise<{ connections: Connection[]; total: number }>
  list(idOrParams?: string | ListOptions) {
    if (typeof idOrParams === 'string') {
      return this.get(idOrParams)
    }
    return this._get<{ connections: Connection[]; total: number }>('/api/v1/connections', idOrParams)
  }
  get(id: string) {
    if (id) {
      return this._get<{ connection: Connection }>('/api/v1/connections', { id })
    }
  }
  create(data: {
    type: ConnectionType
    externalId: string
    displayName: string
    integrationName: string
    authMethodKey?: string
    workspaceId?: string
    endUserId?: string
    scope?: ConnectionScope
    oauthAppId?: string
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
    return this._post<{ connection: Connection }>('/api/v1/connections', data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/connections/${id}`)
  }
  resolve(data: { integrationName: string; workspaceId: string; authMethodKey?: string; externalId?: string; endUserId?: string }) {
    return this._post<{ connection: Connection }>('/api/v1/connections/resolve', data)
  }
}

class ConnectResource extends BaseResource {
  /** Create a connect session token for the hosted connect flow */
  createToken(data: {
    integrationName: string
    workspaceIntegrationId?: string
    authMethodKey?: string
    connectionName: string
    externalId: string
    workspaceId: string
    endUserId?: string
    scope?: ConnectionScope
    oauthAppMode?: OAuthAppMode
    oauthAppId?: string
    successRedirectUri?: string
    errorRedirectUri?: string
  }) {
    return this._post<{ token: string; connectUrl: string; expiresAt: string }>('/api/v1/connect/token', data)
  }
  /** Poll connect session status */
  getSession(sessionId: string) {
    return this._get<{ session: { id: string; integrationName: string; workspaceIntegrationId: string | null; authMethodKey: string | null; oauthAppMode: OAuthAppMode | null; oauthAppId: string | null; connectionName: string; externalId: string; status: string; connectionId: string | null; error: string | null; expiresAt: string; createdAt: string } }>(`/api/v1/connect/session/${sessionId}`)
  }
  /** Poll connect session status using the short-lived cst_ token returned by createToken(). */
  poll(token: string) {
    return this._post<{
      status: 'PENDING' | 'CONNECTING' | 'COMPLETED' | 'FAILED'
      connectionId: string | null
      integrationName: string
      workspaceIntegrationId: string | null
      authMethodKey: string | null
      oauthAppMode: OAuthAppMode | null
      oauthAppId: string | null
      externalId: string
      error: string | null
    }>('/api/v1/connect/session/poll', { token })
  }
  /** Wait for a hosted connect token to complete or fail. */
  async wait(token: string, options?: { timeoutMs?: number; intervalMs?: number }) {
    const timeoutMs = options?.timeoutMs ?? 120_000
    const intervalMs = options?.intervalMs ?? 1_000
    const deadline = Date.now() + timeoutMs

    while (Date.now() <= deadline) {
      const result = await this.poll(token)
      if (result.status === 'COMPLETED' || result.status === 'FAILED') return result
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }

    throw new WeavzError({
      message: 'Connect session timed out',
      code: 'CONNECT_TIMEOUT',
      status: 408,
    })
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
  execute<I extends KnownIntegrationName, A extends KnownActionName<I>>(
    integrationName: I,
    actionName: A,
    options: ExecuteActionOptions<KnownActionInput<I, A>>,
  ): Promise<ActionExecuteResult>
  execute<I extends string>(
    integrationName: I extends KnownIntegrationName ? never : I,
    actionName: string,
    options: ExecuteActionOptions,
  ): Promise<ActionExecuteResult>
  execute(integrationName: string, actionName: string, options: {
    workspaceId: string
    input?: Record<string, unknown>
    connectionExternalId?: string
    authMethodKey?: string
    workspaceIntegrationId?: string
    endUserId?: string
    integrationAlias?: string
    partialIds?: string[]
    idempotencyKey?: string
  }) {
    return this._post<ActionExecuteResult>('/api/v1/actions/execute', {
      integrationName,
      actionName,
      input: options.input ?? {},
      connectionExternalId: options.connectionExternalId,
      authMethodKey: options.authMethodKey,
      workspaceId: options.workspaceId,
      workspaceIntegrationId: options.workspaceIntegrationId,
      endUserId: options.endUserId,
      integrationAlias: options.integrationAlias,
      partialIds: options.partialIds,
      idempotencyKey: options.idempotencyKey,
    }, { 'X-Weavz-Source': 'sdk' })
  }
}

class ApprovalPoliciesResource extends BaseResource {
  list(params?: { workspaceId?: string }) {
    return this._get<{ policies: ApprovalPolicy[]; total: number }>('/api/v1/approval-policies', params)
  }
  create(data: ApprovalPolicyInput) {
    return this._post<{ policy: ApprovalPolicy }>('/api/v1/approval-policies', data)
  }
  get(id: string) {
    return this._get<{ policy: ApprovalPolicy }>(`/api/v1/approval-policies/${id}`)
  }
  update(id: string, data: Partial<ApprovalPolicyInput>) {
    return this._patch<{ policy: ApprovalPolicy }>(`/api/v1/approval-policies/${id}`, data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/approval-policies/${id}`)
  }
  test(data: {
    policy: ApprovalPolicyInput
    context: {
      workspaceId?: string
      endUserId?: string | null
      source?: 'rest' | 'sdk' | 'mcp_tools' | 'mcp_code' | 'playground' | 'trigger'
      mcpServerId?: string | null
      workspaceIntegrationId?: string | null
      integrationName: string
      integrationAlias?: string | null
      actionName: string
      connectionStrategy?: ConnectionStrategy | null
      connectionScopeSummary?: string | null
      partialIds?: string[]
      enforcedKeys?: string[]
      input?: Record<string, unknown>
      idempotencyKey?: string | null
      actionCategories?: string[]
    }
  }) {
    return this._post<{ decision?: 'allow' | 'require_approval' | 'notify_only' | 'block' | 'auto_approve'; matched?: boolean; reasons?: string[] }>(
      '/api/v1/approval-policies/test',
      data,
    )
  }
}

class ApprovalsResource extends BaseResource {
  list(params?: {
    workspaceId?: string
    status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'canceled' | 'consumed'
    source?: 'rest' | 'sdk' | 'mcp_tools' | 'mcp_code' | 'playground' | 'trigger'
    integrationName?: string
    actionName?: string
    limit?: number
  }) {
    return this._get<{ approvals: ApprovalRequest[]; total: number }>('/api/v1/approvals', params)
  }
  get(id: string) {
    return this._get<{ approval: ApprovalRequest }>(`/api/v1/approvals/${id}`)
  }
  approve(id: string, data?: { reason?: string; metadata?: Record<string, unknown> }) {
    return this._post<ApprovalDecisionResult>(`/api/v1/approvals/${id}/approve`, data)
  }
  reject(id: string, data?: { reason?: string; metadata?: Record<string, unknown> }) {
    return this._post<ApprovalDecisionResult>(`/api/v1/approvals/${id}/reject`, data)
  }
  cancel(id: string, data?: { reason?: string; metadata?: Record<string, unknown> }) {
    return this._post<ApprovalDecisionResult>(`/api/v1/approvals/${id}/cancel`, data)
  }
  async wait(id: string, options?: { timeoutMs?: number; intervalMs?: number }) {
    const timeoutMs = options?.timeoutMs ?? 120_000
    const intervalMs = options?.intervalMs ?? 1_000
    const deadline = Date.now() + timeoutMs

    while (Date.now() <= deadline) {
      const result = await this.get(id)
      if (result.approval.status !== 'pending') return result
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }

    throw new WeavzError({
      message: 'Approval wait timed out',
      code: 'APPROVAL_TIMEOUT',
      status: 408,
    })
  }
}

class TriggersResource extends BaseResource {
  list(params?: ListOptions & { workspaceId?: string }) {
    return this._get<{ triggers: TriggerSource[]; total: number }>('/api/v1/triggers', params)
  }
  enable(data: {
    integrationName: string
    triggerName: string
    callbackUrl: string
    workspaceId: string
    callbackHeaders?: Record<string, string>
    callbackMetadata?: Record<string, unknown>
    connectionExternalId?: string
    authMethodKey?: string
    workspaceIntegrationId?: string
    integrationAlias?: string
    endUserId?: string
    input?: Record<string, unknown>
    partialIds?: string[]
    simulate?: boolean
    pollingIntervalMinutes?: number
  }) {
    return this._post<{ triggerSource: TriggerSource }>('/api/v1/triggers/enable', data)
  }
  disable(triggerSourceId: string) {
    return this._post<{ disabled: boolean; triggerSourceId: string }>('/api/v1/triggers/disable', { triggerSourceId })
  }
  test(integrationName: string, triggerName: string) {
    return this._post<{ sampleData: unknown }>('/api/v1/triggers/test', { integrationName, triggerName })
  }
}

class McpServersResource extends BaseResource {
  list(params?: ListOptions & { workspaceId?: string }) {
    return this._get<{ servers: McpServer[]; total: number }>('/api/v1/mcp/servers', params)
  }
  create(data: {
    name: string
    workspaceId: string
    description?: string
    createdBy?: string
    mode?: McpMode
    settings?: McpServerSettings
    authMode?: McpAuthMode
    endUserAccess?: McpEndUserAccess
    endUserId?: string
  }) {
    return this._post<{ server: McpServer; bearerToken?: string; mcpEndpoint: string }>('/api/v1/mcp/servers', data)
  }
  get(id: string) {
    return this._get<{ server: McpServer; tools: McpServerTool[] }>(`/api/v1/mcp/servers/${id}`)
  }
  update(id: string, data: { name?: string; description?: string | null; mode?: McpMode; settings?: McpServerSettings; authMode?: McpAuthMode; endUserAccess?: McpEndUserAccess; endUserId?: string | null }) {
    return this._patch<{ server: McpServer; bearerToken?: string }>(`/api/v1/mcp/servers/${id}`, data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/mcp/servers/${id}`)
  }
  regenerateToken(id: string) {
    return this._post<{ bearerToken: string; mcpEndpoint: string }>(`/api/v1/mcp/servers/${id}/regenerate-token`)
  }
  createAccessToken(id: string, data: { endUserId: string; scopes?: string[]; expiresIn?: number }) {
    return this._post<McpAccessTokenResponse>(
      `/api/v1/mcp/servers/${id}/access-tokens`,
      data,
    )
  }
  createBearerToken(id: string, data: { endUserId: string; scopes?: string[]; expiresIn?: number }) {
    return this.createAccessToken(id, data)
  }
  createEndUserToken(id: string, data: { endUserId: string; scopes?: string[]; expiresIn?: number }) {
    return this.createAccessToken(id, data)
  }
  createOAuthToken(id: string, data: { endUserId: string; scopes?: string[]; expiresIn?: number }) {
    return this._post<{ accessToken: string; token: { id: string; tokenPrefix: string; scopes: string[]; endUserId: string; expiresAt: string; createdAt: string }; mcpEndpoint: string }>(
      `/api/v1/mcp/servers/${id}/oauth-tokens`,
      data,
    )
  }
  addTool(serverId: string, data: {
    integrationName: string
    actionName: string
    integrationAlias?: string
    toolType?: 'ACTION'
    connectionId?: string
    displayName?: string
    description?: string
    inputDefaults?: Record<string, unknown>
    partialIds?: string[]
    sortOrder?: number
  }) {
    return this._post<{ tool: McpServerTool }>(`/api/v1/mcp/servers/${serverId}/tools`, data)
  }
  updateTool(serverId: string, toolId: string, data: {
    displayName?: string
    description?: string | null
    inputDefaults?: Record<string, unknown>
    connectionId?: string | null
    sortOrder?: number
    integrationAlias?: string
    partialIds?: string[]
  }) {
    return this._patch<{ tool: McpServerTool }>(`/api/v1/mcp/servers/${serverId}/tools/${toolId}`, data)
  }
  deleteTool(serverId: string, toolId: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/mcp/servers/${serverId}/tools/${toolId}`)
  }
  executeCode(serverId: string, input: McpCodeExecutionInput) {
    const body = typeof input === 'string' ? { code: input } : input
    return this._post<{ content: unknown[]; isError: boolean }>(`/api/v1/mcp/servers/${serverId}/execute-code`, body)
  }
  getDeclarations(serverId: string, alias: string) {
    return this._get<{ declarations: string }>(`/api/v1/mcp/servers/${serverId}/declarations/${alias}`)
  }
}

class ApiKeysResource extends BaseResource {
  list() {
    return this._get<{ apiKeys: ApiKey[]; total: number }>('/api/v1/api-keys')
  }
  create(data: {
    name: string
    expiresAt?: string
    permissions?: { scope: 'org'; approvals?: { decide?: boolean } } | { scope: 'workspace'; workspaceIds: string[]; approvals?: { decide?: boolean } }
  }) {
    return this._post<{ apiKey: ApiKey; plainKey: string }>('/api/v1/api-keys', data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/api-keys/${id}`)
  }
}

class IntegrationsResource extends BaseResource {
  list(params?: { summary?: false }) {
    return this._get<{ integrations: IntegrationMetadata[]; total: number; registered: string[] }>('/api/v1/integrations', params)
  }
  listSummary() {
    return this._get<{ integrations: IntegrationSummary[]; total: number; registered: string[] }>('/api/v1/integrations', { summary: true })
  }
  get<I extends KnownIntegrationName>(name: I): Promise<{ integration: IntegrationMetadata }>
  get(name: string): Promise<{ integration: IntegrationMetadata }>
  get(name: string) {
    return this._get<{ integration: IntegrationMetadata }>('/api/v1/integrations', { name })
  }
  resolveOptions<I extends KnownIntegrationName, A extends KnownActionName<I>>(
    integrationName: I,
    data: ResolveActionPropertyOptions<I, A>,
  ): Promise<{ options: unknown[]; disabled: boolean }>
  resolveOptions<I extends string>(
    integrationName: I extends KnownIntegrationName ? never : I,
    data: ResolvePropertyOptions,
  ): Promise<{ options: unknown[]; disabled: boolean }>
  resolveOptions(integrationName: string, data: ResolvePropertyOptions) {
    return this._post<{ options: unknown[]; disabled: boolean }>(`/api/v1/integrations/${integrationName}/properties/options`, data)
  }
  resolveProperty<I extends KnownIntegrationName, A extends KnownActionName<I>>(
    integrationName: I,
    data: Omit<ResolveActionPropertyOptions<I, A>, 'searchValue'>,
  ): Promise<unknown>
  resolveProperty<I extends string>(
    integrationName: I extends KnownIntegrationName ? never : I,
    data: Omit<ResolvePropertyOptions, 'searchValue'>,
  ): Promise<unknown>
  resolveProperty(integrationName: string, data: Omit<ResolvePropertyOptions, 'searchValue'>) {
    return this._post<unknown>(`/api/v1/integrations/${integrationName}/properties/resolve`, data)
  }
  oauthStatus() {
    return this._get<{ configured: string[] }>('/api/v1/integrations/oauth-status')
  }
}

class PartialsResource extends BaseResource {
  list(params: {
    workspaceId: string
    integrationName?: string
    workspaceIntegrationId?: string
    integrationAlias?: string
    actionName?: string
    triggerName?: string
  }) {
    return this._get<{ partials: InputPartial[]; total: number }>('/api/v1/partials', params as Record<string, string | number | boolean | undefined>)
  }
  get(id: string) {
    return this._get<{ partial: InputPartial }>(`/api/v1/partials/${id}`)
  }
  create(data: {
    workspaceId: string
    integrationName: string
    workspaceIntegrationId?: string | null
    integrationAlias?: string | null
    name: string
    actionName?: string | null
    triggerName?: string | null
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
  list(params: { workspaceId: string } & ListOptions) {
    return this._get<{ endUsers: EndUser[]; total: number }>('/api/v1/end-users', params)
  }
  get(id: string) {
    return this._get<{ endUser: EndUser; connections: Connection[] }>(`/api/v1/end-users/${id}`)
  }
  update(id: string, data: {
    displayName?: string | null
    email?: string | null
    metadata?: Record<string, unknown> | null
  }) {
    return this._patch<{ endUser: EndUser }>(`/api/v1/end-users/${id}`, data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string; connectionsDeleted: number }>(`/api/v1/end-users/${id}`)
  }
  createConnectToken(id: string, data?: { integrationName?: string; workspaceIntegrationId?: string; expiresIn?: number }) {
    return this._post<{ connectUrl: string; token: string; expiresAt: string }>(`/api/v1/end-users/${id}/connect-token`, data)
  }
  invite(id: string, data: { email: string; integrationName?: string; workspaceIntegrationId?: string; expiresIn?: number }) {
    return this._post<{ connectUrl: string; token: string; expiresAt: string; emailSent: boolean }>(`/api/v1/end-users/${id}/invite`, data)
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
  private readonly fetchImpl: typeof fetch
  private readonly headers: Record<string, string>
  private readonly onRetry?: WeavzClientOptions['onRetry']

  readonly workspaces: WorkspacesResource
  readonly connections: ConnectionsResource
  readonly connect: ConnectResource
  readonly actions: ActionsResource
  readonly approvalPolicies: ApprovalPoliciesResource
  readonly approvals: ApprovalsResource
  readonly triggers: TriggersResource
  readonly mcpServers: McpServersResource
  readonly apiKeys: ApiKeysResource
  readonly integrations: IntegrationsResource
  readonly partials: PartialsResource
  readonly endUsers: EndUsersResource

  constructor(options: WeavzClientOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = (options.baseUrl || 'https://platform.weavz.io').replace(/\/+$/, '')
    this.timeout = options.timeout ?? 310_000
    this.maxRetries = options.maxRetries ?? 2
    this.fetchImpl = options.fetch ?? fetch
    this.headers = options.headers ?? {}
    if (options.userAgent) this.headers['User-Agent'] = options.userAgent
    this.onRetry = options.onRetry

    this.workspaces = new WorkspacesResource(this)
    this.connections = new ConnectionsResource(this)
    this.connect = new ConnectResource(this)
    this.actions = new ActionsResource(this)
    this.approvalPolicies = new ApprovalPoliciesResource(this)
    this.approvals = new ApprovalsResource(this)
    this.triggers = new TriggersResource(this)
    this.mcpServers = new McpServersResource(this)
    this.apiKeys = new ApiKeysResource(this)
    this.integrations = new IntegrationsResource(this)
    this.partials = new PartialsResource(this)
    this.endUsers = new EndUsersResource(this)
  }

  /** Make an authenticated request to the Weavz API */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, params, headers: requestHeaders, signal } = options

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
      ...this.headers,
      ...requestHeaders,
      Authorization: `Bearer ${this.apiKey}`,
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }

    const isIdempotent = method === 'GET' || method === 'PUT' || method === 'DELETE' || method === 'PATCH'

    let lastError: WeavzError | undefined
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      let response: Response
      try {
        response = await this.fetchImpl(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: signal ?? AbortSignal.timeout(this.timeout),
        })
      } catch (error) {
        lastError = new WeavzError({
          message: error instanceof Error ? error.message : 'Network request failed',
          code: error instanceof DOMException && error.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR',
          status: 0,
          details: error,
        })

        if (!isIdempotent || attempt >= this.maxRetries) throw lastError
        const delay = 500 * Math.pow(2, attempt)
        this.onRetry?.({ attempt: attempt + 1, delayMs: delay, error: lastError })
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      if (response.ok) {
        if (response.status === 204) return undefined as T
        const text = await response.text()
        return (text ? JSON.parse(text) : undefined) as T
      }

      let errorBody: { error?: string; code?: string; details?: unknown } = {}
      let errorText = ''
      try {
        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          errorBody = await response.json() as typeof errorBody
        } else {
          errorText = await response.text()
        }
      } catch {
        // ignore parse errors
      }

      lastError = new WeavzError({
        message: errorBody.error || errorText || `HTTP ${response.status}`,
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

      this.onRetry?.({ attempt: attempt + 1, delayMs: delay, error: lastError })
      await new Promise((resolve) => setTimeout(resolve, delay))
    }

    // Should not reach here, but satisfy TypeScript
    throw lastError!
  }
}
