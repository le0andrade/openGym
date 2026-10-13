import { accessConfig } from './access.js'

// Preview identities are deliberately absent from db.json. Disabling development
// mode removes their session lookup and their producer privileges together.
export function createPreviewAccounts(env = process.env) {
  const enabled = accessConfig(env).development && env.SUMMER_PREVIEW === '1'
  const users = enabled ? new Map(['student', 'producer'].map(role => [role, {
    id: 'summer-preview-' + role,
    name: role === 'producer' ? 'Produtor de validação' : 'Aluno de validação',
    previewRole: role, sv: 0
  }])) : new Map()
  return {
    enabled,
    forRole: role => users.get(role) || null,
    lookup: id => [...users.values()].find(user => user.id === id) || null,
    isProducer: user => enabled && !!user && user === users.get('producer')
  }
}

export function previewRoutes({ accounts, json, readBody, sessionCookie }) {
  return {
    'POST /api/summer-shredded/preview/login': async (req, res) => {
      if (!accounts.enabled) return json(res, 404, { error: 'not found' })
      const user = accounts.forRole((await readBody(req)).role)
      if (!user) return json(res, 400, { error: 'invalid preview role' })
      json(res, 200, { user: { id: user.id, name: user.name, admin: accounts.isProducer(user), previewRole: user.previewRole } }, { 'Set-Cookie': sessionCookie(user) })
    }
  }
}
