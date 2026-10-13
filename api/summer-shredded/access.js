import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'

const hash = text => createHash('sha256').update(text).digest('hex')
const emailOf = text => typeof text === 'string' ? text.trim().toLowerCase() : ''
const validEmail = text => text.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
const sameSecret = (a, b) => typeof a === 'string' && typeof b === 'string' && timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)))
const empty = () => ({ schema: 1, orders: {}, bindings: {}, emailOwners: {}, challenges: {}, requests: {}, revokedSubscriptions: {} })
const fault = (message, status = 400) => Object.assign(new Error(message), { status })

export function accessConfig(env = process.env) {
  let products = {}
  try { products = JSON.parse(env.KIWIFY_PRODUCT_MAP || '{}') } catch { throw new Error('invalid KIWIFY_PRODUCT_MAP') }
  if (!products || Array.isArray(products) || Object.values(products).some(v => !['choice', 'masculino', 'feminino'].includes(v))) throw new Error('invalid KIWIFY_PRODUCT_MAP')
  const secret = env.KIWIFY_WEBHOOK_SECRET || ''
  return { products, secret, configured: secret.length >= 32 && Object.keys(products).length > 0,
    development: env.NODE_ENV !== 'production' && env.SUMMER_ACCESS_MODE === 'development',
    emailConfigured: !!(env.RESEND_API_KEY && env.SUMMER_EMAIL_FROM) }
}

export function createAccessStore(dataDir, config, { clock = () => Date.now() } = {}) {
  const file = path.join(dataDir, 'summer-shredded-access.json')
  const read = () => {
    try { const state = JSON.parse(fs.readFileSync(file, 'utf8')); if (state.schema !== 1) throw new Error('invalid access store'); return state }
    catch (e) { if (e.code === 'ENOENT') return empty(); throw e }
  }
  const write = state => { fs.writeFileSync(file + '.tmp', JSON.stringify(state, null, 2), { mode: 0o600 }); fs.renameSync(file + '.tmp', file) }
  const eligible = (state, emailHash) => Object.values(state.orders).filter(o => o.emailHash === emailHash && o.status === 'paid' && config.products[o.productId]
    && !state.revokedSubscriptions[o.subscriptionId] && (!o.accessUntil || o.accessUntil > clock()))
  const status = (uid, admin = false) => {
    if (admin || config.development) return { allowed: true, mode: admin ? 'producer' : 'development', programs: ['masculino', 'feminino'], configured: config.configured }
    if (!config.configured) return { allowed: false, reason: 'integration-not-configured', configured: false }
    const state = read(), binding = state.bindings[uid]
    if (!binding) return { allowed: false, reason: 'purchase-not-linked', configured: true, emailConfigured: config.emailConfigured }
    const orders = eligible(state, binding.emailHash)
    const programs = [...new Set(orders.flatMap(o => config.products[o.productId] === 'choice' ? ['masculino', 'feminino'] : [config.products[o.productId]]))]
    return { allowed: !!programs.length, reason: programs.length ? null : 'purchase-revoked', programs, configured: true, linked: true }
  }
  const event = body => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw fault('invalid event')
    const id = body.order_id, productId = body.Product?.product_id, email = emailOf(body.Customer?.email)
    if (typeof id !== 'string' || !id || id.length > 160 || typeof productId !== 'string') throw fault('invalid order')
    if (!Object.hasOwn(config.products, productId)) return { ignored: 'unmapped-product' }
    if (['__proto__', 'constructor', 'prototype'].includes(id)) throw fault('invalid order')
    const paid = body.webhook_event_type === 'order_approved' && body.order_status === 'paid' && !body.refunded_at
    const revoke = !!body.refunded_at || ['refunded', 'chargedback', 'chargeback', 'canceled', 'cancelled'].includes(body.order_status)
      || ['order_refunded', 'order_chargeback'].includes(body.webhook_event_type)
    const subscription = body.Subscription
    const subscriptionId = typeof body.subscription_id === 'string' ? body.subscription_id : subscription?.id
    if (subscriptionId && typeof subscriptionId !== 'string') throw fault('invalid subscription')
    if (!paid && !revoke && subscription?.customer_access?.has_access !== false) return { ignored: 'non-access-event' }
    const state = read(), before = state.orders[id]
    // A terminal revocation wins even if an old approval is retried later.
    if (before && (before.productId !== productId || (email && before.emailHash !== hash(email)))) throw fault('order identity mismatch')
    if (!before && !validEmail(email)) throw fault('buyer email required')
    let accessUntil = subscription?.customer_access?.access_until ? Date.parse(subscription.customer_access.access_until) : null
    if (accessUntil !== null && !Number.isFinite(accessUntil)) throw fault('invalid access expiry')
    const fence = subscriptionId && subscription?.customer_access?.has_access === false && !Object.hasOwn(state.revokedSubscriptions, subscriptionId)
    if (fence) state.revokedSubscriptions[subscriptionId] = clock()
    if (before?.status === 'revoked' && paid) { if (fence) write(state); return { ignored: 'terminal-order' } }
    const next = { productId, emailHash: before?.emailHash || hash(email), status: revoke ? 'revoked' : paid ? 'paid' : before?.status || 'revoked',
      subscriptionId: subscriptionId || before?.subscriptionId || null, accessUntil: accessUntil ?? before?.accessUntil ?? null }
    if (before && JSON.stringify(before) === JSON.stringify(next)) { if (fence) write(state); return { duplicate: true } }
    state.orders[id] = next; write(state)
    return { ok: true }
  }
  const challenge = (uid, rawEmail) => {
    const email = emailOf(rawEmail)
    if (!validEmail(email)) throw fault('invalid email')
    const state = read(), at = clock(), emailHash = hash(email)
    for (const [id, c] of Object.entries(state.challenges)) if (c.expiresAt <= at) delete state.challenges[id]
    for (const [key, r] of Object.entries(state.requests)) if (r.window <= at - 3600000) delete state.requests[key]
    for (const key of ['uid:' + uid, 'email:' + emailHash]) {
      const request = state.requests[key] || { window: at, count: 0, last: 0 }
      if (request.count >= 10 || (request.count > 0 && at - request.last < 60000)) throw fault('wait before requesting another code', 429)
      state.requests[key] = { ...request, count: request.count + 1, last: at }
    }
    const id = randomUUID(), code = String(randomInt(10000000, 100000000))
    const send = eligible(state, emailHash).length > 0 && (!state.emailOwners[emailHash] || state.emailOwners[emailHash] === uid)
    state.challenges[id] = { uid, emailHash, codeHash: hash(id + ':' + code), expiresAt: at + 600000, attempts: 0 }
    write(state)
    return { id, ...(send ? { email, code } : {}) }
  }
  const verify = (uid, id, code) => {
    const state = read(), c = state.challenges[id]
    if (!c || c.uid !== uid || c.expiresAt <= clock() || c.attempts >= 5) throw fault('invalid or expired code')
    c.attempts++
    const valid = typeof code === 'string' && /^\d{8}$/.test(code) && sameSecret(hash(id + ':' + code), c.codeHash)
    if (!valid || !eligible(state, c.emailHash).length || (state.emailOwners[c.emailHash] && state.emailOwners[c.emailHash] !== uid)) { write(state); throw fault('invalid or expired code') }
    if (state.bindings[uid] && state.bindings[uid].emailHash !== c.emailHash) throw fault('account already linked', 409)
    state.bindings[uid] = { emailHash: c.emailHash, verifiedAt: clock() }; state.emailOwners[c.emailHash] = uid
    delete state.challenges[id]; write(state)
    return status(uid)
  }
  return { status, event, challenge, verify, read }
}

export async function sendAccessCode({ email, code }, env = process.env) {
  if (!env.RESEND_API_KEY || !env.SUMMER_EMAIL_FROM) throw fault('email delivery not configured', 503)
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.SUMMER_EMAIL_FROM, to: [email], subject: 'Seu código de acesso ao Summer Shredded',
      text: `Seu código é ${code}. Ele expira em 10 minutos. Use-o somente no Summer Shredded. Se você não pediu este código, ignore esta mensagem.` }) })
  if (!response.ok) throw fault('could not deliver access code', 503)
}

export function accessRoutes({ dataDir, json, readBody, readSession, isAdmin, env = process.env, sendCode = sendAccessCode }) {
  const config = accessConfig(env), store = createAccessStore(dataDir, config)
  const requireAccess = (req, res) => {
    const user = readSession(req)
    if (!user) { json(res, 401, { error: 'not signed in' }); return null }
    const access = store.status(user.id, isAdmin(user))
    if (!access.allowed) { json(res, 403, { error: 'purchase access required', access }); return null }
    return { user, access }
  }
  const routes = {
    'GET /api/summer-shredded/access': async (req, res) => {
      const user = readSession(req); if (!user) return json(res, 401, { error: 'not signed in' })
      json(res, 200, store.status(user.id, isAdmin(user)))
    },
    'POST /api/webhooks/kiwify': async (req, res) => {
      if (!config.configured) return json(res, 503, { error: 'integration not configured' })
      const key = new URL(req.url, 'http://localhost').searchParams.get('key')
      if (!sameSecret(key, config.secret)) return json(res, 401, { error: 'invalid webhook credential' })
      try { json(res, 200, store.event(await readBody(req))) }
      catch (e) { json(res, e.status || 500, { error: e.status ? e.message : 'event could not be persisted' }) }
    },
    'POST /api/summer-shredded/access/request': async (req, res) => {
      const user = readSession(req); if (!user) return json(res, 401, { error: 'not signed in' })
      if (!config.configured || !config.emailConfigured) return json(res, 503, { error: 'access verification not configured' })
      try {
        const c = store.challenge(user.id, (await readBody(req)).email)
        if (c.email) await sendCode(c, env)
        json(res, 200, { challengeId: c.id, message: 'If an eligible purchase exists, a code was sent.' })
      } catch (e) { json(res, e.status || 503, { error: e.status ? e.message : 'email unavailable' }) }
    },
    'POST /api/summer-shredded/access/verify': async (req, res) => {
      const user = readSession(req); if (!user) return json(res, 401, { error: 'not signed in' })
      try { const b = await readBody(req); json(res, 200, store.verify(user.id, b.challengeId, b.code)) }
      catch (e) { json(res, e.status || 500, { error: e.status ? e.message : 'verification unavailable' }) }
    }
  }
  return { routes, requireAccess, store }
}
