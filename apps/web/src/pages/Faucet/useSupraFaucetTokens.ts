import { useMemo } from 'react'
import { useTradingApiSwappableTokensQuery } from 'uniswap/src/data/apiClients/tradingApi/useTradingApiSwappableTokensQuery'
import { SUPRA_WSUPRA_ADDRESS } from 'uniswap/src/features/chains/evm/info/supra'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import {
  getTokenAddressFromChainForTradingApi,
  toTradingApiSupportedChainId,
} from 'uniswap/src/features/transactions/swap/utils/tradingApi'
import { normalizeTokenAddressForCache } from 'uniswap/src/utils/currencyId'
import { FAUCET_DISPENSABLE_TOKENS, SUPRA_FAUCET_TOKENS, type FaucetToken } from '~/pages/Faucet/tokens'

export interface FaucetTokenListState {
  tokens: readonly FaucetToken[]
  isLoading: boolean
  /**
   * True when the list came from the local registry because the API was unreachable, errored,
   * or returned nothing this faucet can actually dispense. Surfaced so the page can say so
   * rather than silently looking like a complete list.
   */
  isFallback: boolean
}

/**
 * Token list for the faucet dropdown, sourced from the same Trading API endpoint the swap form
 * uses — `/v1/swappable_tokens`, via `useTradingApiSwappableTokensQuery`.
 *
 * The endpoint answers "what can be traded against this token on this chain", so it needs a
 * seed token rather than just a chain; WSUPRA is used, being the chain's wrapped native and the
 * one token guaranteed to exist here.
 *
 * Two things the API cannot tell us, hence the intersection with `FAUCET_DISPENSABLE_TOKENS`:
 *
 *   1. *Whether* the faucet can dispense a token. Existing and being swappable is not the same
 *      as being obtainable — WSUPRA is minted by wrapping native SUPRA, and a bridged test token
 *      would need its own `faucet(address)`. Listing everything the API returns would offer
 *      tokens whose "Get faucet" button could only fail.
 *   2. *How* to dispense it, which is what `FaucetAction` records.
 *
 * What the API does contribute is authoritative metadata — decimals, symbol and name — replacing
 * values that would otherwise be hardcoded or read one contract call at a time.
 */
export function useSupraFaucetTokens(): FaucetTokenListState {
  const tokenInChainId = toTradingApiSupportedChainId(UniverseChainId.Supra)
  const tokenIn = getTokenAddressFromChainForTradingApi(SUPRA_WSUPRA_ADDRESS, UniverseChainId.Supra)

  const { data, isLoading } = useTradingApiSwappableTokensQuery({
    params: tokenInChainId ? { tokenIn, tokenInChainId } : undefined,
  })

  return useMemo(() => {
    const dispensable = data?.tokens
      ? data.tokens.reduce<FaucetToken[]>((acc, token) => {
          const known = FAUCET_DISPENSABLE_TOKENS.get(normalizeTokenAddressForCache(token.address))
          if (!known) {
            return acc
          }
          acc.push({
            address: token.address,
            // The API's metadata wins; the local registry exists only so the page still
            // works when the API does not.
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            action: known.action,
          })
          return acc
        }, [])
      : []

    if (dispensable.length > 0) {
      return { tokens: dispensable, isLoading, isFallback: false }
    }

    return { tokens: SUPRA_FAUCET_TOKENS, isLoading, isFallback: !isLoading }
  }, [data?.tokens, isLoading])
}
