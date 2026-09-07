import { SUPRA_WSUPRA_ADDRESS } from 'uniswap/src/features/chains/evm/info/supra'
import { normalizeTokenAddressForCache } from 'uniswap/src/utils/currencyId'

export enum FaucetAction {
  /**
   * Minted by wrapping the equivalent amount of native SUPRA through `ERC20SupraHandler`
   * 1:1. Takes an amount, and that amount is spent from the user's native balance.
   */
  Wrap = 'wrap',
  /**
   * Obtained by calling the token's own permissionless `faucet(address)`, which mints a
   * fixed amount to the recipient. Takes no amount and costs nothing but gas.
   *
   * No token currently uses this, but the flow is kept wired up (see `MintPanel` and
   * `useSupraFaucetMint`) so a mintable test token is a one-entry addition to the list
   * below rather than a rebuild.
   */
  Mint = 'mint',
}

export interface FaucetToken {
  address: string
  symbol: string
  name: string
  action: FaucetAction
  /**
   * Supplied by the token-list API. Absent on the local fallback entries, where it is read
   * on-chain instead — never assumed, since only WSUPRA's 18 is verified.
   */
  decimals?: number
}

/**
 * Fallback token list, used when the token-list API is unreachable or returns nothing this
 * faucet can dispense. The live list comes from `useSupraFaucetTokens`.
 *
 * Deliberately just WSUPRA for now. The bridged WETH/WBTC test tokens
 * (`SUPRA_BRIDGED_WETH_ADDRESS` / `SUPRA_BRIDGED_WBTC_ADDRESS` in supra.ts) were considered:
 * they expose a permissionless `faucet(address)` per supralend-frontend's `SupraFaucetService`,
 * which verified the selector in their bytecode on 2026-08-05. They are left out until that is
 * re-verified against a reachable node and someone actually wants them here — adding one is a
 * single `FaucetAction.Mint` entry below.
 *
 * An explicit list rather than the backend token list: Supra's chain-info `tokens` contains only
 * WSUPRA, and a faucet needs to know the *mechanism* per token, which no token list carries. The
 * dropdown is kept even with a single entry so adding the second is a one-line change.
 *
 * Decimals are intentionally absent: they are read from each token contract at render time.
 * Only WSUPRA's 18 is verified on-chain, and hardcoding a guess for a future token would
 * silently misreport balances.
 */
export const SUPRA_FAUCET_TOKENS: readonly FaucetToken[] = [
  {
    address: SUPRA_WSUPRA_ADDRESS,
    symbol: 'WSUPRA',
    name: 'Wrapped Supra',
    action: FaucetAction.Wrap,
  },
]

/** Only one token is supported today, so it is also the default selection. */
export const DEFAULT_FAUCET_TOKEN: FaucetToken = SUPRA_FAUCET_TOKENS[0]

/**
 * Which tokens this faucet can actually dispense, and how — keyed by normalized address.
 *
 * The token-list API reports what exists and is swappable on the chain, which is not the same
 * question. A token only belongs here if there is a real mechanism to obtain it: wrapping for
 * WSUPRA, or a permissionless `faucet(address)` for a mintable test token. Everything the API
 * returns that is absent from this map is filtered out of the dropdown, so the page never
 * offers a token whose "Get faucet" could only fail.
 *
 * Adding a token means one entry here plus, if it is not already in the API's response, one in
 * the fallback list above.
 */
export const FAUCET_DISPENSABLE_TOKENS: ReadonlyMap<string, FaucetToken> = new Map(
  SUPRA_FAUCET_TOKENS.map((token) => [normalizeTokenAddressForCache(token.address), token]),
)
