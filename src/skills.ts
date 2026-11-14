import type { WeavzClient } from './client'

export type SkillScope = 'end_user' | 'workspace'
export type SkillLibraryOptions =
  | { workspaceId: string; scope?: 'end_user'; endUserId: string }
  | { workspaceId: string; scope: 'workspace'; endUserId?: never }
export interface SkillMetadata {
  id: string
  workspaceId: string
  scope: SkillScope
  slug: string
  name: string
  description: string
  tags: string[]
  enabled: boolean
  version: number
  createdAt: string
  updatedAt: string
}
export interface Skill extends SkillMetadata { markdown: string }
export interface SkillResponse { skill: Skill; permissions: { canWrite: boolean }; instructionNotice?: string }
export interface SkillListResponse {
  skills: SkillMetadata[]
  pagination: { limit: number; offset: number; total: number }
  permissions: { canWrite: boolean }
}
export type SkillListOptions = SkillLibraryOptions & { query?: string; tag?: string; includeDisabled?: boolean; limit?: number; offset?: number }
export type CreateSkillOptions = SkillLibraryOptions & { slug: string; name: string; markdown: string; description?: string; tags?: string[]; enabled?: boolean }
export type UpdateSkillOptions = SkillLibraryOptions & { expectedVersion: number; slug?: string; name?: string; markdown?: string; description?: string; tags?: string[]; enabled?: boolean }
export type DeleteSkillOptions = SkillLibraryOptions & { expectedVersion: number }

/** Optional instructions. Search is metadata-only; read a chosen skill explicitly. */
export class SkillsResource {
  constructor(private client: WeavzClient) {}
  list(options: SkillListOptions) {
    return this.client.request<SkillListResponse>('/api/v1/skills', { method: 'GET', params: options })
  }
  search(options: SkillListOptions & { query: string }) { return this.list(options) }
  get(id: string, options: SkillLibraryOptions) {
    return this.client.request<SkillResponse>(this.path(id), { method: 'GET', params: options })
  }
  create(options: CreateSkillOptions) {
    return this.client.request<SkillResponse>('/api/v1/skills', { method: 'POST', body: options })
  }
  update(id: string, options: UpdateSkillOptions) {
    return this.client.request<SkillResponse>(this.path(id), { method: 'PATCH', body: options })
  }
  delete(id: string, options: DeleteSkillOptions) {
    return this.client.request<{ deleted: true; id: string }>(this.path(id), { method: 'DELETE', params: options })
  }
  private path(id: string) {
    if (id === '.' || id === '..') throw new TypeError('Resource identifiers cannot be dot segments')
    return '/api/v1/skills/' + encodeURIComponent(id)
  }
}
