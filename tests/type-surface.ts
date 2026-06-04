import { WeavzClient, integrationActions, integrationNames, isKnownActionName, isKnownIntegrationName } from '../src'
import type { ActionInput, ActionName, ActionPropertyName, IntegrationActionKey, IntegrationName } from '../src'

const integrationName: IntegrationName = 'http'
const actionName: ActionName<'http'> = 'send_request'
const actionKey: IntegrationActionKey = 'http.send_request'
const propertyName: ActionPropertyName<'http', 'send_request'> = 'method'

const input: ActionInput<'http', 'send_request'> = {
  method: 'GET',
  url: 'https://example.com',
  headers: {},
  queryParams: {},
  authType: 'NONE',
}

const client = new WeavzClient({ apiKey: 'wvz_test' })

client.actions.execute('http', 'send_request', {
  workspaceId: '00000000-0000-0000-0000-000000000000',
  input,
})

client.integrations.get('http')

client.integrations.resolveOptions('http', {
  actionName: 'send_request',
  propertyName: 'method',
  input: { method: 'GET' },
})

client.integrations.resolveProperty('http', {
  actionName: 'send_request',
  propertyName: 'body',
  input: { body_type: 'json' },
})

const dynamicIntegrationName: string = 'future-integration'
client.actions.execute(dynamicIntegrationName, 'future_action', {
  workspaceId: '00000000-0000-0000-0000-000000000000',
  input: { future: true },
})

isKnownIntegrationName(dynamicIntegrationName)
isKnownActionName('http', actionName)
integrationNames.includes(integrationName)
integrationActions.http.includes(actionName)
actionKey satisfies IntegrationActionKey
propertyName satisfies ActionPropertyName<'http', 'send_request'>

// @ts-expect-error unknown integration literals should not type-check as known names
const badIntegrationName: IntegrationName = 'not-real'

// @ts-expect-error known integration literals should reject unknown action names
const badActionName: ActionName<'http'> = 'not_real'

// @ts-expect-error known integration/action literals should reject unknown property names
const badPropertyName: ActionPropertyName<'http', 'send_request'> = 'not_real'

// @ts-expect-error known integration/action literals should use generated input unions
client.actions.execute('http', 'send_request', {
  workspaceId: '00000000-0000-0000-0000-000000000000',
  input: { ...input, method: 'TRACE' },
})

// @ts-expect-error property resolution for known actions should reject unknown properties
client.integrations.resolveOptions('http', {
  actionName: 'send_request',
  propertyName: 'not_real',
})
