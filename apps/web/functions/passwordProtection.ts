/**
 * Site-wide password gate.
 *
 * Blocks every request (SPA shell, static assets, and BFF proxy routes alike)
 * behind a single shared password until the visitor submits it once. On
 * success we set a signed, httpOnly cookie so the browser stays authenticated
 * for `COOKIE_MAX_AGE_SECONDS`.
 *
 * Config is env-driven and both knobs default to "on":
 *   - PASSWORD_PROTECTION_ENABLED — set to the literal string "false" to
 *     disable the gate entirely. Anything else (including unset) keeps it on.
 *   - PASSWORD_PROTECTION_PASSWORD — the shared password. If unset, falls
 *     back to DEFAULT_PASSWORD_PROTECTION_PASSWORD below.
 *
 * SECURITY NOTE FOR OPERATORS: the fallback password is committed source and
 * therefore public. It exists only so the gate still works out of the box in
 * local/dev environments. Any real (staging/production) deployment MUST set
 * PASSWORD_PROTECTION_PASSWORD via a platform secret — e.g.
 * `wrangler secret put PASSWORD_PROTECTION_PASSWORD` on Cloudflare, or the
 * Vercel/ECS environment-variable store — never as a plaintext `vars` entry
 * committed to wrangler config. The cookie is HMAC-signed with the password
 * itself, so rotating the password also invalidates every existing session.
 */
import type { Context, MiddlewareHandler } from 'hono'
import { getSignedCookie, setSignedCookie } from 'hono/cookie'

export const PASSWORD_PROTECTION_COOKIE_NAME = 'supra_site_auth'
const COOKIE_VALUE = 'granted'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days
export const LOGIN_ACTION_PATH = '/__site-auth/login'

// Public branding assets only — never add anything that reveals app data.
const BYPASS_PATHS = new Set(['/favicon.ico', '/favicon.png'])

// Only ever used when the operator has not configured PASSWORD_PROTECTION_PASSWORD.
// See the SECURITY NOTE above.
export const DEFAULT_PASSWORD_PROTECTION_PASSWORD = 'Supraswap@2026'

export function resolveIsPasswordProtectionEnabled(rawValue: string | undefined): boolean {
  if (rawValue === undefined || rawValue.trim() === '') {
    return true
  }
  return rawValue.trim().toLowerCase() !== 'false'
}

export function resolvePasswordProtectionPassword(rawValue: string | undefined): string {
  return rawValue && rawValue.length > 0 ? rawValue : DEFAULT_PASSWORD_PROTECTION_PASSWORD
}

export interface PasswordProtectionConfig {
  isEnabled: (c: Context) => boolean
  getPassword: (c: Context) => string
}

/** SHA-256s both inputs before comparing so neither length nor content is leaked via timing. */
async function safeEquals(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ])
  const bytesA = new Uint8Array(digestA)
  const bytesB = new Uint8Array(digestB)
  let diff = 0
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i]
  }
  return diff === 0
}

/** Only ever redirect within this origin — blocks the login form being used as an open redirect. */
function safeRedirectTarget(rawPath: string | null | undefined): string {
  if (!rawPath || !rawPath.startsWith('/') || rawPath.startsWith('//') || rawPath.includes('\\')) {
    return '/'
  }
  return rawPath
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderLoginPage({ redirectTo, error }: { redirectTo: string; error: boolean }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, nofollow" />
<title>Protected — Supra Swap</title>
<link rel="shortcut icon" type="image/png" href="/favicon.png" />
<style>
  :root {
    color-scheme: light dark;
    --bg: #ffffff;
    --card: #f9f9f9;
    --text: #131313;
    --text-secondary: rgba(19, 19, 19, 0.6);
    --border: rgba(19, 19, 19, 0.08);
    --input-bg: #ffffff;
    --accent: #ff37c7;
    --accent-hover: #e500a5;
    --error: #ff4d4d;
    --error-bg: rgba(255, 77, 77, 0.08);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #131313;
      --card: #1f1f1f;
      --text: #ffffff;
      --text-secondary: rgba(255, 255, 255, 0.6);
      --border: rgba(255, 255, 255, 0.12);
      --input-bg: #131313;
      --error-bg: rgba(255, 77, 77, 0.12);
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    color: var(--text);
    font-family: 'Basel', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    padding: 24px;
  }
  .card {
    width: 100%;
    max-width: 380px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 32px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  }
  .icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--accent), var(--accent-hover));
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
  }
  h1 {
    font-size: 20px;
    font-weight: 535;
    margin: 0 0 6px;
  }
  p.subtitle {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0 0 24px;
    line-height: 1.4;
  }
  label {
    display: block;
    font-size: 13px;
    font-weight: 535;
    margin-bottom: 8px;
  }
  .input-row {
    position: relative;
    margin-bottom: 8px;
  }
  input[type='password'],
  input[type='text'] {
    width: 100%;
    padding: 12px 44px 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--text);
    font-size: 15px;
    outline: none;
    transition: border-color 0.15s ease;
  }
  input:focus { border-color: var(--accent); }
  .toggle {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    color: var(--text-secondary);
    display: flex;
  }
  .error {
    display: ${error ? 'flex' : 'none'};
    align-items: center;
    gap: 8px;
    background: var(--error-bg);
    color: var(--error);
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 13px;
    margin-bottom: 16px;
  }
  button.submit {
    width: 100%;
    margin-top: 16px;
    padding: 13px;
    border: none;
    border-radius: 12px;
    background: var(--accent);
    color: #ffffff;
    font-size: 15px;
    font-weight: 535;
    cursor: pointer;
    transition: background 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  button.submit:hover { background: var(--accent-hover); }
  button.submit:disabled {
    opacity: 0.75;
    cursor: not-allowed;
  }
  .spinner {
    width: 15px;
    height: 15px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #ffffff;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  footer {
    margin-top: 20px;
    text-align: center;
    font-size: 12px;
    color: var(--text-secondary);
  }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 10V8a6 6 0 1 1 12 0v2" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
        <rect x="4" y="10" width="16" height="11" rx="2.5" stroke="#fff" stroke-width="2"/>
        <circle cx="12" cy="15.5" r="1.5" fill="#fff"/>
      </svg>
    </div>
    <h1>This site is password protected</h1>
    <p class="subtitle">Enter the access password to continue to Supra Swap.</p>
    <div class="error">Incorrect password. Please try again.</div>
    <form method="POST" action="${LOGIN_ACTION_PATH}" autocomplete="off" id="login-form">
      <input type="hidden" name="redirect" value="${escapeHtml(redirectTo)}" />
      <label for="password">Password</label>
      <div class="input-row">
        <input
          id="password"
          name="password"
          type="password"
          placeholder="Enter your password"
          autocomplete="current-password"
          autofocus
          required
        />
        <button type="button" class="toggle" id="toggle-password" aria-label="Show password">
          <svg id="eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="2"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
          </svg>
          <svg id="eye-off-icon" style="display: none" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="2"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
            <path d="M3 3l18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <button type="submit" class="submit" id="submit-button">
        <span id="submit-label">Continue</span>
      </button>
    </form>
    <footer>Supra Swap · Protected preview</footer>
  </div>
  <script>
    document.getElementById('toggle-password').addEventListener('click', function () {
      var input = document.getElementById('password')
      var eyeIcon = document.getElementById('eye-icon')
      var eyeOffIcon = document.getElementById('eye-off-icon')
      var isPassword = input.type === 'password'
      input.type = isPassword ? 'text' : 'password'
      eyeIcon.style.display = isPassword ? 'none' : 'block'
      eyeOffIcon.style.display = isPassword ? 'block' : 'none'
      this.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password')
    })
    document.getElementById('login-form').addEventListener('submit', function () {
      var button = document.getElementById('submit-button')
      button.disabled = true
      document.getElementById('submit-label').textContent = 'Verifying…'
      var spinner = document.createElement('span')
      spinner.className = 'spinner'
      button.prepend(spinner)
    })
  </script>
</body>
</html>`
}

async function handleLoginSubmit(c: Context, password: string): Promise<Response> {
  const formData = await c.req.formData()
  const submitted = String(formData.get('password') ?? '')
  const redirectTo = safeRedirectTarget(String(formData.get('redirect') ?? '/'))

  if (!(await safeEquals(submitted, password))) {
    return c.html(renderLoginPage({ redirectTo, error: true }), 401, { 'Cache-Control': 'no-store' })
  }

  const url = new URL(c.req.url)
  await setSignedCookie(c, PASSWORD_PROTECTION_COOKIE_NAME, COOKIE_VALUE, password, {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })

  return c.redirect(redirectTo, 303)
}

export function createPasswordProtectionMiddleware(config: PasswordProtectionConfig): MiddlewareHandler {
  return async (c, next) => {
    if (!config.isEnabled(c)) {
      await next()
      return
    }

    const url = new URL(c.req.url)

    if (BYPASS_PATHS.has(url.pathname)) {
      await next()
      return
    }

    const password = config.getPassword(c)

    if (url.pathname === LOGIN_ACTION_PATH && c.req.method === 'POST') {
      return handleLoginSubmit(c, password)
    }

    let cookieValue: string | undefined | false
    try {
      cookieValue = await getSignedCookie(c, password, PASSWORD_PROTECTION_COOKIE_NAME)
    } catch {
      cookieValue = undefined
    }

    if (cookieValue === COOKIE_VALUE) {
      await next()
      return
    }

    const redirectTo = safeRedirectTarget(url.pathname + url.search)
    return c.html(renderLoginPage({ redirectTo, error: false }), 401, {
      'Cache-Control': 'no-store',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    })
  }
}
