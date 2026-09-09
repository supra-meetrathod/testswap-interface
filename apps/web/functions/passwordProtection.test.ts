import { createApp } from 'functions/app'
import {
  DEFAULT_PASSWORD_PROTECTION_PASSWORD,
  LOGIN_ACTION_PATH,
  PASSWORD_PROTECTION_COOKIE_NAME,
  resolveIsPasswordProtectionEnabled,
  resolvePasswordProtectionPassword,
} from 'functions/passwordProtection'

const mockHtml = `<!DOCTYPE html><html><head><title>Uniswap</title></head><body></body></html>`
const TEST_PASSWORD = 'correct-horse-battery-staple'

function buildApp({ enabled = true, password = TEST_PASSWORD }: { enabled?: boolean; password?: string } = {}) {
  return createApp({
    fetchSpaHtml: async () => new Response(mockHtml, { headers: { 'content-type': 'text/html' } }),
    getEntryGatewayUrl: () => 'https://entry-gateway.example.com',
    getWebSocketUrl: () => 'https://websockets.example.com',
    getTrustedClientIp: () => undefined,
    getEmbedFrameAncestors: () => undefined,
    isPasswordProtectionEnabled: () => enabled,
    getPasswordProtectionPassword: () => password,
  })
}

/** Pulls just the `name=value` pair out of a Set-Cookie header for reuse on the next request. */
function extractCookiePair(setCookieHeader: string | null): string {
  if (!setCookieHeader) {
    throw new Error('Expected a Set-Cookie header')
  }
  return setCookieHeader.split(';')[0]
}

describe('resolveIsPasswordProtectionEnabled', () => {
  it.each([undefined, '', '   ', 'true', 'TRUE', 'anything-else'])('treats %j as enabled', (value) => {
    expect(resolveIsPasswordProtectionEnabled(value)).toBe(true)
  })

  it.each(['false', 'FALSE', ' False '])('treats %j as disabled', (value) => {
    expect(resolveIsPasswordProtectionEnabled(value)).toBe(false)
  })
})

describe('resolvePasswordProtectionPassword', () => {
  it('falls back to the default password when unset', () => {
    expect(resolvePasswordProtectionPassword(undefined)).toBe(DEFAULT_PASSWORD_PROTECTION_PASSWORD)
    expect(resolvePasswordProtectionPassword('')).toBe(DEFAULT_PASSWORD_PROTECTION_PASSWORD)
  })

  it('uses the configured password when set', () => {
    expect(resolvePasswordProtectionPassword('hunter2')).toBe('hunter2')
  })
})

describe('password protection middleware', () => {
  it('blocks an unauthenticated request with the login page', async () => {
    const app = buildApp()
    const res = await app.request('/')

    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toContain('text/html')
    const body = await res.text()
    expect(body).toContain(`action="${LOGIN_ACTION_PATH}"`)
    expect(body).not.toContain(mockHtml)
  })

  it('never caches the login page', async () => {
    const app = buildApp()
    const res = await app.request('/')

    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('lets the request through when protection is disabled', async () => {
    const app = buildApp({ enabled: false })
    const res = await app.request('/')

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<title>Uniswap</title>')
  })

  it('bypasses the gate for the favicon so the login page can render branding', async () => {
    const app = buildApp()
    const res = await app.request('/favicon.png')

    expect(res.status).toBe(200)
  })

  it('rejects an incorrect password without setting a cookie', async () => {
    const app = buildApp()
    const res = await app.request(LOGIN_ACTION_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'password=wrong',
    })

    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(await res.text()).toContain('Incorrect password')
  })

  it('accepts the correct password, sets a signed cookie, and redirects', async () => {
    const app = buildApp()
    const res = await app.request(LOGIN_ACTION_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `password=${encodeURIComponent(TEST_PASSWORD)}&redirect=${encodeURIComponent('/swap')}`,
    })

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/swap')
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain(`${PASSWORD_PROTECTION_COOKIE_NAME}=`)
    expect(setCookie).toContain('HttpOnly')
  })

  it('falls back to "/" for an off-site redirect target (open-redirect guard)', async () => {
    const app = buildApp()
    const res = await app.request(LOGIN_ACTION_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `password=${encodeURIComponent(TEST_PASSWORD)}&redirect=${encodeURIComponent('https://evil.example.com')}`,
    })

    expect(res.headers.get('location')).toBe('/')
  })

  it('grants access on subsequent requests once the cookie is set', async () => {
    const app = buildApp()
    const loginRes = await app.request(LOGIN_ACTION_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `password=${encodeURIComponent(TEST_PASSWORD)}`,
    })
    const cookie = extractCookiePair(loginRes.headers.get('set-cookie'))

    const res = await app.request('/', { headers: { Cookie: cookie } })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<title>Uniswap</title>')
  })

  it('rejects a cookie signed with a different password', async () => {
    const app = buildApp()
    const loginRes = await app.request(LOGIN_ACTION_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `password=${encodeURIComponent(TEST_PASSWORD)}`,
    })
    const cookie = extractCookiePair(loginRes.headers.get('set-cookie'))

    const rotatedApp = buildApp({ password: 'a-brand-new-password' })
    const res = await rotatedApp.request('/', { headers: { Cookie: cookie } })

    expect(res.status).toBe(401)
  })
})
