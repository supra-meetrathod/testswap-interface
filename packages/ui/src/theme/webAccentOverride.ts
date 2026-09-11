// SupraSwap brand accent (official brand color per https://supra.com/brand/). Only
// `apps/web` currently wires a config through this module (both its Vite Tamagui
// extraction config and its runtime tamagui.config.ts), so this intentionally leaves
// mobile/extension's Uniswap pink accent untouched even though the module lives in
// this shared package. Consumers must spread these values into their `themes` object
// literal directly (not via a helper function) — passing the merged themes through an
// intermediate function call breaks Tamagui's `createTamagui()` generic type inference.
export const SUPRA_ACCENT = {
  light: {
    accent1: '#DD1438',
    accent1Hovered: '#B8102E',
    accent2: 'rgba(221, 20, 56, 0.08)',
    accent2Hovered: 'rgba(221, 20, 56, 0.12)',
    accent2Solid: '#FDEBEE',
  },
  dark: {
    accent1: '#FF3B57',
    accent1Hovered: '#E0102E',
    accent2: 'rgba(255, 59, 87, 0.08)',
    accent2Hovered: 'rgba(255, 59, 87, 0.12)',
    accent2Solid: '#2A1519',
  },
} as const
