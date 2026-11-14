import { describe, expect, it, vi } from 'vitest'
import { WeavzClient, WeavzError } from '../src'

const library = { workspaceId: '11111111-1111-4111-8111-111111111111', endUserId: 'customer/alice@example.test' }
function fixture(body: unknown = {}, status = 200) {
  const fetch = vi.fn(async (_url: string, _init: RequestInit) => Response.json(body, { status }))
  return { fetch, client: new WeavzClient({ apiKey: 'wvz_fixture', baseUrl: 'https://api.example.test', maxRetries: 2, fetch: fetch as typeof globalThis.fetch }) }
}
describe('Skills SDK transport', () => {
  it('sends metadata search and pagination as query parameters without reading content', async () => {
    const response = { skills: [{ id: 'skill', name: 'Brief', version: 1 }], pagination: { limit: 5, offset: 10, total: 30 }, permissions: { canWrite: true } }
    const { client, fetch } = fixture(response)
    const result = await client.skills.search({ ...library, query: 'account % brief', tag: 'sales', includeDisabled: true, limit: 5, offset: 10 })
    const [url, init] = fetch.mock.calls[0]
    const params = new URL(url).searchParams
    expect(init.method).toBe('GET')
    expect(params.get('endUserId')).toBe(library.endUserId)
    expect(params.get('query')).toBe('account % brief')
    expect(params.get('includeDisabled')).toBe('true')
    expect(params.get('offset')).toBe('10')
    expect(result).toEqual(response)
    expect(fetch).toHaveBeenCalledOnce()
  })
  it('encodes one identifier and explicitly reads a shared skill without an owner selector', async () => {
    const { client, fetch } = fixture({ skill: { markdown: '# Instructions' }, permissions: { canWrite: true } })
    await client.skills.get('skill/a?b#c', { workspaceId: library.workspaceId, scope: 'workspace' })
    const url = new URL(fetch.mock.calls[0][0])
    expect(url.pathname).toBe('/api/v1/skills/skill%2Fa%3Fb%23c')
    expect(url.searchParams.has('endUserId')).toBe(false)
    expect(url.searchParams.get('scope')).toBe('workspace')
  })
  it('creates authored instructions as JSON without logging or embedding them in the URL', async () => {
    const { client, fetch } = fixture()
    const body = { ...library, slug: 'brief', name: 'Brief', markdown: '# Private task instructions', tags: ['sales'], enabled: false }
    await client.skills.create(body)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.example.test/api/v1/skills')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual(body)
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer wvz_fixture')
  })
  it('keeps updates sparse while preserving false, empty tags and expectedVersion', async () => {
    const { client, fetch } = fixture()
    await client.skills.update('skill', { ...library, expectedVersion: 4, enabled: false, tags: [], description: '' })
    const init = fetch.mock.calls[0][1]
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual({ ...library, expectedVersion: 4, enabled: false, tags: [], description: '' })
  })
  it('requires a current version on deletion and sends selectors in the query only', async () => {
    const { client, fetch } = fixture({ deleted: true, id: 'skill' })
    await client.skills.delete('skill', { ...library, expectedVersion: 7 })
    const [url, init] = fetch.mock.calls[0]
    expect(init.method).toBe('DELETE')
    expect(new URL(url).searchParams.get('expectedVersion')).toBe('7')
    expect(init.body).toBeUndefined()
  })
  it('surfaces an edit conflict without retrying the mutation', async () => {
    const { client, fetch } = fixture({ error: 'Changed since opening', code: 'SKILL_CONFLICT' }, 409)
    await expect(client.skills.update('skill', { ...library, expectedVersion: 1, name: 'Old draft' })).rejects.toBeInstanceOf(WeavzError)
    expect(fetch).toHaveBeenCalledOnce()
  })
})
