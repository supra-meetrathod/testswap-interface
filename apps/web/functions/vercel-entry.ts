// Vercel serverless function entry point (bundled by build-vercel.ts)
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handle } from '@hono/node-server/vercel'
import { createApp, ENTRY_GATEWAY_URLS, WEBSOCKET_URLS } from 'functions/app'
import { resolveIsPasswordProtectionEnabled, resolvePasswordProtectionPassword } from 'functions/passwordProtection'

// Note: upgradeWebSocket is not provided because Vercel serverless functions
// do not support long-lived WebSocket connections. On Vercel staging,
// the BFF proxy handles REST API calls for cookie handling, but WebSocket
// connections use direct backend URLs.

// build-vercel.ts moves index.html out of the public static output and next to
// this bundle, so the SPA shell can only be reached through this function (and
// therefore through the password gate). Resolve relative to the bundle, not cwd.
const SPA_HTML_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'spa.html')

let spaHtmlPromise: Promise<string> | undefined
function getSpaHtml(): Promise<string> {
  spaHtmlPromise ??= readFile(SPA_HTML_PATH, 'utf-8').catch((error: unknown) => {
    spaHtmlPromise = undefined
    throw error
  })
  return spaHtmlPromise
}

const app = createApp({
  fetchSpaHtml: async () => {
    const html = await getSpaHtml()
    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Never let the CDN cache the shell: a shared cached copy would be served
        // to visitors without the auth cookie, bypassing the password gate.
        'cache-control': 'private, no-cache',
      },
    })
  },
  getEntryGatewayUrl: (_c, env) => {
    if (env) {
      return ENTRY_GATEWAY_URLS[env]
    }
    return process.env.ENTRY_GATEWAY_API_URL || ENTRY_GATEWAY_URLS.staging
  },
  getWebSocketUrl: () => process.env.WEBSOCKET_URL || WEBSOCKET_URLS.staging,
  getTrustedClientIp: (c) => c.req.header('x-real-ip'),
  getEmbedFrameAncestors: () => process.env.EMBED_FRAME_ANCESTORS,
  isPasswordProtectionEnabled: () => resolveIsPasswordProtectionEnabled(process.env.PASSWORD_PROTECTION_ENABLED),
  getPasswordProtectionPassword: () => resolvePasswordProtectionPassword(process.env.PASSWORD_PROTECTION_PASSWORD),
})

export default handle(app)
