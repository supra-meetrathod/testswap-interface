// oxlint-disable-next-line universe-custom/no-relative-import-paths -- repo-root single source of brand truth, no package-local alias exists for it
import { BRAND } from '../../../../brand.config'

// SupraSwap brand accent, sourced from the root `brand.config.ts`. Only `apps/web`
// currently wires a config through this module (both its Vite Tamagui extraction
// config and its runtime tamagui.config.ts), so this intentionally leaves
// mobile/extension's Uniswap pink accent untouched even though the module lives in
// this shared package. Consumers must spread these values into their `themes` object
// literal directly (not via a helper function) — passing the merged themes through an
// intermediate function call breaks Tamagui's `createTamagui()` generic type inference.
export const SUPRA_ACCENT = {
  light: BRAND.colors.accentLight,
  dark: BRAND.colors.accentDark,
} as const
