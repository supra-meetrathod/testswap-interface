import type { useLocalizationContext } from 'uniswap/src/features/language/LocalizationContext'

/**
 * The localized number formatter, threaded down from the page rather than re-derived in each
 * panel so every panel formats balances identically.
 */
export type FormatNumberOrString = ReturnType<typeof useLocalizationContext>['formatNumberOrString']
