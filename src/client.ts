import { WeavzError } from './errors'
import { SkillsResource } from './skills'
import type {
  ApiKey,
  ApprovalDecisionResult,
  ApprovalPolicy,
  ApprovalPolicyInput,
  ApprovalRequest as GeneratedApprovalRequest,
  ApprovalRequiredResult,
  Connection,
  AdvancedCodeWorkspaceSettings as GeneratedAdvancedCodeWorkspaceSettings,
  EndUser as GeneratedEndUser,
  ExecuteMcpCodeResponse,
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

export type ComputerSessionAccessRole = 'watch' | 'control'
export interface ComputerSessionAccessOptions {
  workspaceId: string
  /** Your external end-user ID, not a Weavz internal user UUID. */
  endUserId: string
  role: ComputerSessionAccessRole
  /** Link lifetime in seconds, from 1 to 300, bounded by the session lifetime. */
  ttlSeconds?: number
  /** Exact HTTPS origin of the application that embeds the viewer. */
  frameOrigin?: string
}
export interface ComputerSessionAccess {
  sessionId: string
  role: ComputerSessionAccessRole
  /** Sensitive human viewer capability. Keep this URL out of agent/tool context. */
  viewerUrl: string
  expiresAt: string
  frameOrigin?: string
}
export interface ApprovalReviewAccess {
  canDecide: boolean
  reason?: string
  code?: string
}
export type ApprovalRequest = GeneratedApprovalRequest & { reviewAccess?: ApprovalReviewAccess }
export type ApprovalPolicyUpdateInput = Omit<Partial<ApprovalPolicyInput>, 'workspaceId'> & { workspaceId?: string | null }

export interface WaitOptions {
  /** Total time to wait, including API requests and retry delays (default: 120000). */
  timeoutMs?: number
  /** Delay between pending responses in milliseconds (default: 1000). */
  intervalMs?: number
  signal?: AbortSignal
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
    return this._get<{ workspace: Workspace }>(`/api/v1/workspaces/${encodeURIComponent(id)}`)
  }
  update(id: string, data: { name?: string; slug?: string }) {
    return this._patch<{ workspace: Workspace }>(`/api/v1/workspaces/${encodeURIComponent(id)}`, data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/workspaces/${encodeURIComponent(id)}`)
  }
  listIntegrations(workspaceId: string) {
    return this._get<{ integrations: WorkspaceIntegration[]; total: number }>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/integrations`)
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
    return this._post<{ integration: WorkspaceIntegration }>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/integrations`, data)
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
    return this._patch<{ integration: WorkspaceIntegration }>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/integrations/${encodeURIComponent(id)}`, data)
  }
  removeIntegration(workspaceId: string, id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/integrations/${encodeURIComponent(id)}`)
  }
}

class ConnectionsResource extends BaseResource {
  list(id: string): Promise<{ connection: Connection }>
  list(params?: ListOptions): Promise<{ connections: Connection[]; total: number }>
  list(idOrParams?: string | ListOptions) {
    if (typeof idOrParams === 'string') {
      return this.get(idOrParams)
    }
    return this._get<{ connections: Connection[]; total: number }>('/api/v1/connections', idOrParams)
  }
  get(id: string) {
    if (!id) return Promise.reject(new WeavzError({ message: 'A connection ID is required', code: 'INVALID_REQUEST', status: 0 }))
    return this._get<{ connection: Connection }>('/api/v1/connections', { id })
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
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/connections/${encodeURIComponent(id)}`)
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
    return this._get<{ session: { id: string; integrationName: string; workspaceIntegrationId: string | null; authMethodKey: string | null; oauthAppMode: OAuthAppMode | null; oauthAppId: string | null; connectionName: string; externalId: string; status: string; connectionId: string | null; error: string | null; expiresAt: string; createdAt: string } }>(`/api/v1/connect/session/${encodeURIComponent(sessionId)}`)
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
  async wait(token: string, options?: WaitOptions) {
    return waitForResult(
      signal => this.client.request<Awaited<ReturnType<ConnectResource['poll']>>>('/api/v1/connect/session/poll', { method: 'POST', body: { token }, signal }),
      result => result.status === 'COMPLETED' || result.status === 'FAILED',
      options, 'CONNECT_TIMEOUT', 'Connect session timed out',
    )
  }
  /**
   * Open a popup for the hosted connect flow (browser-only).
   * Resolves with the connection result when complete.
   */
  async popup(options: { token: string; connectUrl: string }): Promise<{ connectionId: string; integrationName: string; externalId: string }> {
    return openConnectPopup(options)
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
    return this._get<{ policy: ApprovalPolicy }>(`/api/v1/approval-policies/${encodeURIComponent(id)}`)
  }
  update(id: string, data: ApprovalPolicyUpdateInput) {
    return this._patch<{ policy: ApprovalPolicy }>(`/api/v1/approval-policies/${encodeURIComponent(id)}`, data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/approval-policies/${encodeURIComponent(id)}`)
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
    status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'canceled' | 'consumed' | 'history'
    source?: 'rest' | 'sdk' | 'mcp_tools' | 'mcp_code' | 'playground' | 'trigger'
    integrationName?: string
    actionName?: string
    limit?: number
    cursor?: string
  }) {
    return this._get<{ approvals: ApprovalRequest[]; total: number; nextCursor: string | null }>('/api/v1/approvals', params)
  }
  get(id: string) {
    return this._get<{ approval: ApprovalRequest }>(`/api/v1/approvals/${encodeURIComponent(id)}`)
  }
  approve(id: string, data?: { reason?: string; metadata?: Record<string, unknown> }) {
    return this._post<ApprovalDecisionResult>(`/api/v1/approvals/${encodeURIComponent(id)}/approve`, data)
  }
  reject(id: string, data?: { reason?: string; metadata?: Record<string, unknown> }) {
    return this._post<ApprovalDecisionResult>(`/api/v1/approvals/${encodeURIComponent(id)}/reject`, data)
  }
  cancel(id: string, data?: { reason?: string; metadata?: Record<string, unknown> }) {
    return this._post<ApprovalDecisionResult>(`/api/v1/approvals/${encodeURIComponent(id)}/cancel`, data)
  }
  async wait(id: string, options?: WaitOptions) {
    return waitForResult(
      signal => this.client.request<{ approval: ApprovalRequest }>(`/api/v1/approvals/${encodeURIComponent(id)}`, { signal }),
      result => result.approval.status !== 'pending',
      options, 'APPROVAL_TIMEOUT', 'Approval wait timed out',
    )
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
    return this._get<{ server: McpServer; tools: McpServerTool[] }>(`/api/v1/mcp/servers/${encodeURIComponent(id)}`)
  }
  update(id: string, data: { name?: string; description?: string | null; mode?: McpMode; settings?: McpServerSettings; authMode?: McpAuthMode; endUserAccess?: McpEndUserAccess; endUserId?: string | null }) {
    return this._patch<{ server: McpServer; bearerToken?: string }>(`/api/v1/mcp/servers/${encodeURIComponent(id)}`, data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/mcp/servers/${encodeURIComponent(id)}`)
  }
  regenerateToken(id: string) {
    return this._post<{ bearerToken: string; mcpEndpoint: string }>(`/api/v1/mcp/servers/${encodeURIComponent(id)}/regenerate-token`)
  }
  createAccessToken(id: string, data: { endUserId: string; scopes?: string[]; expiresIn?: number }) {
    return this._post<McpAccessTokenResponse>(
      `/api/v1/mcp/servers/${encodeURIComponent(id)}/access-tokens`,
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
      `/api/v1/mcp/servers/${encodeURIComponent(id)}/oauth-tokens`,
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
    description?: string | null
    inputDefaults?: Record<string, unknown>
    partialIds?: string[]
    sortOrder?: number
  }) {
    return this._post<{ tool: McpServerTool }>(`/api/v1/mcp/servers/${encodeURIComponent(serverId)}/tools`, data)
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
    return this._patch<{ tool: McpServerTool }>(`/api/v1/mcp/servers/${encodeURIComponent(serverId)}/tools/${encodeURIComponent(toolId)}`, data)
  }
  deleteTool(serverId: string, toolId: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/mcp/servers/${encodeURIComponent(serverId)}/tools/${encodeURIComponent(toolId)}`)
  }
  executeCode(serverId: string, input: McpCodeExecutionInput) {
    const body = typeof input === 'string' ? { code: input } : input
    return this._post<ExecuteMcpCodeResponse>(`/api/v1/mcp/servers/${encodeURIComponent(serverId)}/execute-code`, body)
  }
  getDeclarations(serverId: string, alias: string) {
    return this._get<{ declarations: string }>(`/api/v1/mcp/servers/${encodeURIComponent(serverId)}/declarations/${encodeURIComponent(alias)}`)
  }
}

class ComputerSessionsResource extends BaseResource {
  /** Issue a short-lived human viewer link from your trusted backend. */
  createAccess(sessionId: string, options: ComputerSessionAccessOptions) {
    return this._post<ComputerSessionAccess>(`/api/v1/computer-sessions/${encodeURIComponent(sessionId)}/access`, options)
  }
}

class ApiKeysResource extends BaseResource {
  list() {
    return this._get<{ apiKeys: ApiKey[]; total: number }>('/api/v1/api-keys')
  }
  create(data: {
    name: string
    expiresAt?: string
    permissions?: { scope: 'org'; approvals?: { decide?: boolean } } | { scope: 'workspace'; workspaceIds: string[]; approvals?: { decide?: boolean } } | null
  }) {
    return this._post<{ apiKey: ApiKey; plainKey: string }>('/api/v1/api-keys', data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/api-keys/${encodeURIComponent(id)}`)
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
    return this._post<{ options: unknown[]; disabled: boolean }>(`/api/v1/integrations/${encodeURIComponent(integrationName)}/properties/options`, data)
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
    return this._post<unknown>(`/api/v1/integrations/${encodeURIComponent(integrationName)}/properties/resolve`, data)
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
    return this._get<{ partial: InputPartial }>(`/api/v1/partials/${encodeURIComponent(id)}`)
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
    return this._patch<{ partial: InputPartial }>(`/api/v1/partials/${encodeURIComponent(id)}`, data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string }>(`/api/v1/partials/${encodeURIComponent(id)}`)
  }
  setDefault(id: string, isDefault: boolean) {
    return this._post<{ partial: InputPartial }>(`/api/v1/partials/${encodeURIComponent(id)}/set-default`, { isDefault })
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
    return this._get<{ endUser: EndUser; connections: Connection[] }>(`/api/v1/end-users/${encodeURIComponent(id)}`)
  }
  update(id: string, data: {
    displayName?: string | null
    email?: string | null
    metadata?: Record<string, unknown> | null
  }) {
    return this._patch<{ endUser: EndUser }>(`/api/v1/end-users/${encodeURIComponent(id)}`, data)
  }
  delete(id: string) {
    return this._del<{ deleted: boolean; id: string; connectionsDeleted: number }>(`/api/v1/end-users/${encodeURIComponent(id)}`)
  }
  createConnectToken(id: string, data?: { integrationName?: string; workspaceIntegrationId?: string; expiresIn?: number }) {
    return this._post<{ connectUrl: string; token: string; expiresAt: string }>(`/api/v1/end-users/${encodeURIComponent(id)}/connect-token`, data)
  }
  invite(id: string, data: { email: string; integrationName?: string; workspaceIntegrationId?: string; expiresIn?: number }) {
    return this._post<{ connectUrl: string; token: string; expiresAt: string; emailSent: boolean }>(`/api/v1/end-users/${encodeURIComponent(id)}/invite`, data)
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
  readonly computerSessions: ComputerSessionsResource
  readonly skills: SkillsResource

  constructor(options: WeavzClientOptions) {
    if (typeof options.apiKey !== 'string' || !options.apiKey.trim()) throw new TypeError('apiKey must be a non-empty string')
    if (options.timeout !== undefined && (!Number.isSafeInteger(options.timeout) || options.timeout <= 0 || options.timeout > 2_147_483_647)) throw new TypeError('timeout must be a positive integer of at most 2147483647 milliseconds')
    if (options.maxRetries !== undefined && (!Number.isSafeInteger(options.maxRetries) || options.maxRetries < 0)) throw new TypeError('maxRetries must be a non-negative integer')
    const base = new URL(options.baseUrl || 'https://platform.weavz.io')
    if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new TypeError('baseUrl must be an HTTP(S) URL without credentials, a query, or a fragment')
    this.apiKey = options.apiKey
    this.baseUrl = base.toString().replace(/\/+$/, '')
    this.timeout = options.timeout ?? 310_000
    this.maxRetries = options.maxRetries ?? 2
    this.fetchImpl = options.fetch ?? fetch
    this.headers = { ...options.headers }
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
    this.computerSessions = new ComputerSessionsResource(this)
    this.skills = new SkillsResource(this)
  }

  /** Make an authenticated request to the Weavz API. Timeout applies to each attempt, including its response body. */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method: requestedMethod = 'GET', body, params, headers: requestHeaders, signal } = options
    const method = requestedMethod.toUpperCase()
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new WeavzError({ message: 'Request paths must start with a single slash', code: 'INVALID_REQUEST', status: 0 })
    }
    const url = new URL(`${this.baseUrl}${path}`)
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value))
      }
    }
    const headers = new Headers(this.headers)
    for (const [name, value] of Object.entries(requestHeaders ?? {})) headers.set(name, value)
    headers.set('Authorization', `Bearer ${this.apiKey}`)
    if (body !== undefined) headers.set('Content-Type', 'application/json')

    let serializedBody: string | undefined
    try { serializedBody = body === undefined ? undefined : JSON.stringify(body) }
    catch { throw new WeavzError({ message: 'Request body must be JSON serializable', code: 'INVALID_REQUEST', status: 0 }) }
    const isIdempotent = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'].includes(method)

    for (let attempt = 0; ; attempt++) {
      if (signal?.aborted) throw requestAbortError(signal)
      const controller = new AbortController()
      let timedOut = false
      const onAbort = () => controller.abort(signal?.reason)
      signal?.addEventListener('abort', onAbort, { once: true })
      const timeout = setTimeout(() => {
        timedOut = true
        controller.abort(new DOMException('Request timed out', 'TimeoutError'))
      }, this.timeout)
      let response: Response
      let text: string
      try {
        response = await this.fetchImpl(url.toString(), { method, headers, body: serializedBody, signal: controller.signal })
        text = response.status === 204 ? '' : await response.text()
      } catch (error) {
        if (signal?.aborted) throw requestAbortError(signal)
        const failure = new WeavzError({
          message: timedOut ? 'Request timed out' : error instanceof Error ? error.message : 'Network request failed',
          code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR', status: 0, details: error,
        })
        if (!isIdempotent || attempt >= this.maxRetries) throw failure
        const delay = retryDelay(attempt)
        this.onRetry?.({ attempt: attempt + 1, delayMs: delay, error: failure })
        // Release per-attempt resources before waiting for another attempt.
        clearTimeout(timeout)
        signal?.removeEventListener('abort', onAbort)
        await retrySleep(delay, signal)
        continue
      } finally {
        clearTimeout(timeout)
        signal?.removeEventListener('abort', onAbort)
      }

      if (response.ok) {
        if (!text) return undefined as T
        try { return JSON.parse(text) as T }
        catch { throw new WeavzError({ message: 'The API returned an invalid JSON response', code: 'INVALID_RESPONSE', status: response.status }) }
      }
      let errorBody: { error?: unknown; code?: unknown; details?: unknown } = {}
      try {
        const parsed: unknown = JSON.parse(text)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) errorBody = parsed
      } catch { /* Non-JSON HTTP errors retain their original response text. */ }
      const failure = new WeavzError({
        message: typeof errorBody.error === 'string' ? errorBody.error : text || `HTTP ${response.status}`,
        code: typeof errorBody.code === 'string' ? errorBody.code : 'HTTP_ERROR',
        status: response.status, details: errorBody.details,
      })
      const shouldRetry = response.status === 429 || (response.status >= 500 && response.status < 600 && isIdempotent)
      if (!shouldRetry || attempt >= this.maxRetries) throw failure
      const delay = retryDelay(attempt, response.headers.get('Retry-After'))
      this.onRetry?.({ attempt: attempt + 1, delayMs: delay, error: failure })
      await retrySleep(delay, signal)
    }
  }
}

function requestAbortError(signal: AbortSignal): WeavzError {
  return new WeavzError({ message: 'Request aborted', code: 'ABORTED', status: 0, details: signal.reason })
}

function retryDelay(attempt: number, retryAfter?: string | null): number {
  const fallback = Math.min(500 * 2 ** attempt, 60_000)
  if (!retryAfter?.trim()) return fallback
  const seconds = Number(retryAfter)
  const parsed = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now()
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, 60_000) : fallback
}

function retrySleep(delay: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(requestAbortError(signal))
  return new Promise((resolve, reject) => {
    const onAbort = () => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); reject(requestAbortError(signal!)) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve() }, delay)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function waitForResult<T>(poll: (signal: AbortSignal) => Promise<T>, complete: (result: T) => boolean, options: WaitOptions | undefined, code: string, message: string): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 120_000
  const intervalMs = options?.intervalMs ?? 1000
  for (const [name, value] of Object.entries({ timeoutMs, intervalMs })) {
    if (!Number.isSafeInteger(value) || value <= 0 || value > 2_147_483_647) throw new TypeError(`${name} must be a positive integer of at most 2147483647 milliseconds`)
  }
  const controller = new AbortController()
  const onAbort = () => controller.abort(options?.signal?.reason)
  if (options?.signal?.aborted) throw requestAbortError(options.signal)
  options?.signal?.addEventListener('abort', onAbort, { once: true })
  let timedOut = false
  const timeout = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
  try {
    while (true) {
      const result = await poll(controller.signal)
      if (complete(result)) return result
      await retrySleep(intervalMs, controller.signal)
    }
  } catch (error) {
    if (timedOut && !options?.signal?.aborted) throw new WeavzError({ message, code, status: 408 })
    throw error
  } finally {
    clearTimeout(timeout)
    options?.signal?.removeEventListener('abort', onAbort)
  }
}

/** Open a short-lived Hosted Connect URL in a browser without creating an API-key client. */
export async function openConnectPopup(options: { connectUrl: string }): Promise<{ connectionId: string; integrationName: string; externalId: string }> {
  if (typeof window === 'undefined') throw new WeavzError({ message: 'The popup helper requires a browser', code: 'BROWSER_REQUIRED', status: 0 })
  const connectUrl = new URL(options.connectUrl)
  if (!['http:', 'https:'].includes(connectUrl.protocol)) throw new TypeError('connectUrl must use HTTP(S)')
  const popup = window.open(connectUrl.toString(), '_blank', 'width=500,height=600,popup=yes')
  if (!popup) throw new WeavzError({ message: 'The connection popup was blocked. Allow popups or open the connect URL directly.', code: 'POPUP_BLOCKED', status: 0 })

  return new Promise((resolve, reject) => {
    let closeTimer: ReturnType<typeof setTimeout> | undefined
    const cleanup = () => {
      clearInterval(interval)
      if (closeTimer) clearTimeout(closeTimer)
      window.removeEventListener('message', handler)
    }
    const handler = (event: MessageEvent) => {
      if (event.source !== popup || event.origin !== connectUrl.origin || event.data?.type !== 'weavz-connect-result') return
      if (event.data.status === 'error') {
        cleanup()
        reject(new Error(event.data.error || 'Connection failed'))
        return
      }
      if (event.data.status !== 'success' || !['connectionId', 'integrationName', 'externalId'].every(key => typeof event.data[key] === 'string' && event.data[key].length > 0)) return
      cleanup()
      resolve({ connectionId: event.data.connectionId, integrationName: event.data.integrationName, externalId: event.data.externalId })
    }
    const interval = setInterval(() => {
      if (!popup.closed) return
      clearInterval(interval)
      // Give a final postMessage time to arrive after the popup closes.
      closeTimer = setTimeout(() => { cleanup(); reject(new Error('Popup closed before completing')) }, 3000)
    }, 500)
    window.addEventListener('message', handler)
  })
}
