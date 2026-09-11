/**
 * Single source of truth for the brand-owned, swappable values actually wired into
 * `apps/web` (the SupraSwap-branded fork of the Uniswap interface).
 *
 * Scope — apps/web only, on purpose
 * ----------------------------------
 * Only `apps/web` has been rebranded from "Uniswap" to "SupraSwap" so far.
 * `apps/mobile`, `apps/extension`, and the shared SDK/UI packages still ship under the
 * Uniswap name deliberately — see git history on `feat/supraswap-branding`. This file
 * does not carry placeholder fields for those apps; add them only when those apps
 * actually get rebranded, so every field here can be trusted to be live and wired.
 *
 * Known Uniswap references left in apps/web on purpose (not oversights, not config
 * fields here — each is either a real external Uniswap product/entity or an
 * undecided legal question):
 *   - `apps/web/src/pages/Landing/sections/Footer.tsx` — github.com/Uniswap, x.com/Uniswap,
 *     the Uniswap brand-assets zip, and the "© {year} - Uniswap Labs" copyright line.
 *   - `apps/web/src/components/NavBar/CompanyMenu/Content.tsx` — About/Careers/Blog/
 *     Governance links, all real uniswap.org pages with no Supra equivalent.
 *   - The connect-wallet modal's "Uniswap Mobile" option, its ToS legal copy, and
 *     `apps/web/src/connection/walletConnect.ts`'s `uniswapWalletConnect()` (deep-links
 *     to the real, separate Uniswap Wallet mobile app — a different product from this site).
 *   - `apps/web/src/pages/Swap/Limit/RouterLabel/RouterLabel.tsx`'s "Uniswap X" /
 *     "Uniswap API" labels — Uniswap's own off-chain routing products, not this app's name.
 *   - "Uniswap v2/v3/v4" wherever it names the actual on-chain protocol version this
 *     frontend talks to (e.g. several `title.*` i18n keys), not the app's own brand.
 *
 * Constraints
 * -----------
 * 1. ZERO IMPORTS. `apps/web/vite/vite.plugins.ts` and other build-time Vite plugins
 *    import this in plain Node before any app runtime exists.
 * 2. No environment branching — env-specific values belong in `apps/web/src/config.ts`.
 * 3. Keep it serializable (plain strings/numbers/booleans only) — values get injected
 *    into `apps/web/index.html` at build time.
 *
 * How to change the brand
 * ------------------------
 * Edit the values below. Each field's doc comment names the file(s) that currently
 * import it, so a value change takes effect everywhere without hunting.
 */

// #region Types

export interface BrandProductNames {
  /**
   * The web app's display name. Currently: `apps/web/index.html` `<title>` (via the
   * `brandHtmlPlugin` in `apps/web/vite/vite.plugins.ts`), `apps/web/src/App.tsx`
   * (per-route title fallback), `apps/web/functions/components/metaTagInjector.ts`
   * (default OG/Twitter title), `apps/web/src/connection/walletConnect.ts`
   * (WalletConnect connector metadata shown in external wallet UIs), and
   * `apps/web/src/components/NavBar/CompanyMenu/index.tsx` (header wordmark, gated by
   * `navBar.showBrandName`).
   *
   * NOTE: the i18n keys `interface.metatags.title` / `interface.metatags.description`
   * and the `title.*` keys in `packages/uniswap/src/i18n/locales/source/en-US.json`
   * also spell out "SupraSwap" but are translation strings, not code — they must be
   * kept in sync with this value by hand when it changes.
   */
  webApp: string
}

export interface BrandDescriptions {
  /**
   * Edge-injected default OG/Twitter description for crawlers, used when a route has
   * no more specific description. Currently:
   * `apps/web/functions/components/metaTagInjector.ts`.
   */
  webMetaCrawler: string
  /** OG card body for `/launches`. Currently: `apps/web/functions/components/metaTagInjector.ts`. */
  launches: string
  /** OG card title for `/launches`. Currently: `apps/web/functions/components/metaTagInjector.ts`. */
  launchesTitle: string
}

/** Paths are web-server-absolute, resolved against `apps/web/public/`. */
export interface BrandWebAssets {
  /**
   * PNG favicon, also used as the WalletConnect connector icon. Currently:
   * `apps/web/index.html` (via `brandHtmlPlugin`), `apps/web/src/connection/walletConnect.ts`.
   */
  faviconPng: string
  /**
   * 1200x630 OG/Twitter card. Currently: `apps/web/src/pages/metatags.ts`,
   * `apps/web/functions/components/metaTagInjector.ts`.
   */
  socialCardImage: string
  /**
   * `<meta name="theme-color">` and the light-mode background gradient tint. Currently:
   * `apps/web/index.html` (via `brandHtmlPlugin`). Kept equal to `colors.accentLight`
   * so the browser chrome and the accent color never drift apart.
   */
  themeColor: string
}

/**
 * Accent color pair, light/dark. Currently: `packages/ui/src/theme/webAccentOverride.ts`
 * (`SUPRA_ACCENT`, consumed by `apps/web/src/tamagui.config.ts` and the Vite Tamagui
 * static-extraction config at `packages/ui/src/tamagui.config.ts` — see
 * `[[tamagui-theme-override-gotcha]]` before touching either call site).
 */
export interface BrandAccentColors {
  accent1: string
  accent1Hovered: string
  accent2: string
  accent2Hovered: string
  accent2Solid: string
}

export interface BrandColors {
  accentLight: BrandAccentColors
  accentDark: BrandAccentColors
}

export interface BrandNavBar {
  /**
   * Render the brand name as text beside the header logo mark. Currently:
   * `apps/web/src/components/NavBar/CompanyMenu/index.tsx`.
   */
  showBrandName: boolean
}

export interface BrandConfig {
  /** Bare brand name, used as the base every other product/copy string is built from. */
  name: string
  products: BrandProductNames
  descriptions: BrandDescriptions
  webAssets: BrandWebAssets
  colors: BrandColors
  navBar: BrandNavBar
}

// #endregion

// #region Values

const BRAND_NAME = 'SupraSwap'

/** Official Supra brand color (https://supra.com/brand/), already used for the Supra chain badge. */
const ACCENT_LIGHT = '#DD1438'
const ACCENT_DARK = '#FF3B57'

export const BRAND: BrandConfig = {
  name: BRAND_NAME,

  products: {
    webApp: BRAND_NAME,
  },

  descriptions: {
    webMetaCrawler: 'Swap crypto on Ethereum, Base, Arbitrum, Polygon, Unichain and more. The DeFi platform trusted by millions.',
    launches: 'Discover and trade new token launches across launchpads, all in one place.',
    launchesTitle: `Token launches on ${BRAND_NAME}`,
  },

  webAssets: {
    faviconPng: '/favicon.png',
    socialCardImage: '/images/1200x630_Rich_Link_Preview_Image.png',
    themeColor: ACCENT_LIGHT,
  },

  colors: {
    accentLight: {
      accent1: ACCENT_LIGHT,
      accent1Hovered: '#B8102E',
      accent2: 'rgba(221, 20, 56, 0.08)',
      accent2Hovered: 'rgba(221, 20, 56, 0.12)',
      accent2Solid: '#FDEBEE',
    },
    accentDark: {
      accent1: ACCENT_DARK,
      accent1Hovered: '#E0102E',
      accent2: 'rgba(255, 59, 87, 0.08)',
      accent2Hovered: 'rgba(255, 59, 87, 0.12)',
      accent2Solid: '#2A1519',
    },
  },

  navBar: {
    showBrandName: true,
  },
}

// #endregion
