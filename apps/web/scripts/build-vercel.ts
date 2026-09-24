/**
 * Post-build packaging for Vercel Build Output API v3.
 *
 * Run AFTER the Vite SPA build (via NX in vercel.json buildCommand).
 *
 * 1. Creates .vercel/output/ directory structure
 * 2. Copies static assets from build/ -> .vercel/output/static/
 * 3. Bundles the Hono serverless function -> .vercel/output/functions/api.func/index.mjs
 * 4. Writes .vc-config.json and config.json
 *
 * Usage: see vercel.json buildCommand
 */
import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { copyOgAssets, inlineAssetPlugin, tsconfigPathsPlugin } from './bun-server-build'

const ROOT = resolve(import.meta.dirname, '..')
const OUTPUT_DIR = resolve(ROOT, '.vercel/output')
const STATIC_DIR = resolve(OUTPUT_DIR, 'static')
const FUNC_DIR = resolve(OUTPUT_DIR, 'functions/api.func')

// ── Step 1: Clean and create output directory ───────────────────────────
console.log('[build-vercel] Creating .vercel/output/ directory structure...')
if (existsSync(OUTPUT_DIR)) {
  rmSync(OUTPUT_DIR, { recursive: true })
}
mkdirSync(FUNC_DIR, { recursive: true })

// ── Step 2: Copy Vite build output to static/ ──────────────────────────
console.log('[build-vercel] Copying static assets...')
const buildDir = resolve(ROOT, 'build')
if (!existsSync(buildDir)) {
  throw new Error('Vite build output not found at ' + buildDir)
}
cpSync(buildDir, STATIC_DIR, { recursive: true })

// Move the SPA shell out of static/ so the CDN can never serve it directly —
// the function reads it from disk (see vercel-entry.ts), which keeps every HTML
// response behind the password gate.
const staticSpaHtml = resolve(STATIC_DIR, 'index.html')
if (!existsSync(staticSpaHtml)) {
  throw new Error('SPA shell not found at ' + staticSpaHtml)
}
renameSync(staticSpaHtml, resolve(FUNC_DIR, 'spa.html'))

// ── Step 3: Bundle the Hono serverless function ─────────────────────────
console.log('[build-vercel] Bundling serverless function...')
const entryPoint = resolve(ROOT, 'functions/vercel-entry.ts')
if (!existsSync(entryPoint)) {
  throw new Error('Serverless function entry point not found at ' + entryPoint)
}

const bundleResult = await Bun.build({
  entrypoints: [entryPoint],
  outdir: FUNC_DIR,
  naming: 'index.mjs',
  target: 'node',
  format: 'esm',
  plugins: [tsconfigPathsPlugin, inlineAssetPlugin],
})

if (!bundleResult.success) {
  console.error('[build-vercel] Bundle errors:')
  for (const log of bundleResult.logs) {
    console.error(log)
  }
  throw new Error('Failed to bundle serverless function')
}

console.log('[build-vercel] Serverless function bundled successfully')

// ── Step 3b: Copy @vercel/og runtime assets ─────────────────────────────
copyOgAssets(FUNC_DIR)
console.log('[build-vercel] Copied @vercel/og runtime assets')

// ── Step 4: Write .vc-config.json ───────────────────────────────────────
console.log('[build-vercel] Writing .vc-config.json...')
writeFileSync(
  resolve(FUNC_DIR, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      maxDuration: 30,
    },
    null,
    2,
  ) + '\n',
)

// ── Step 5: Write config.json ───────────────────────────────────────────
console.log('[build-vercel] Writing config.json...')
writeFileSync(
  resolve(OUTPUT_DIR, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        // Cache-Control headers for static assets (continue: true applies headers without stopping)
        {
          src: '^/assets/(.*)$',
          headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
          continue: true,
        },
        {
          src: '^/fonts/(.*)$',
          headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
          continue: true,
        },
        {
          src: '^/favicon\\.ico$',
          headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
          continue: true,
        },
        // SPA shell is not in static/ (see Step 2) -> serverless function
        { src: '^/index\\.html$', dest: '/api' },
        // API routes -> serverless function
        { src: '^/api(?:/(.*))?$', dest: '/api' },
        // Entry gateway BFF proxy -> serverless function
        { src: '^/entry-gateway(?:/(.*))?$', dest: '/api' },
        // Config proxy (statsig) -> serverless function
        { src: '^/config(?:/(.*))?$', dest: '/api' },
        // Note: no /ws route — Vercel cannot proxy WebSocket connections (neither
        // through functions nor external rewrites). On Vercel, prices use REST
        // polling via the /entry-gateway proxy. WS is only used on CF Workers (staging/prod).
        // All extensionless paths (incl. `/`) -> serverless function (SPA + meta tag
        // injection). Routed before the filesystem phase, and with no static
        // index.html fallback, so HTML is only ever served via the password gate.
        { src: '^/[^.]*$', dest: '/api' },
        // Try static files (assets, fonts, favicon, etc.)
        { handle: 'filesystem' },
      ],
    },
    null,
    2,
  ) + '\n',
)

console.log('[build-vercel] Build complete!')
console.log('[build-vercel] Output: .vercel/output/')
