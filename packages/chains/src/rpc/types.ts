// oxlint-disable-next-line eslint/no-restricted-imports -- canonical source of truth: this file defines UniverseChainId by aliasing the SDK enum
import { ChainId as UniswapSDKChainId } from '@uniswap/sdk-core'

/** Supra chain id — sole const for this value, everything else references it. */
export const SUPRA_CHAIN_ID = 953497288926 as const

/**
 * Chain identifiers used across the Uniswap ecosystem.
 * Canonical source of truth — other packages re-export from here.
 */
export enum UniverseChainId {
  Mainnet = UniswapSDKChainId.MAINNET,
  ArbitrumOne = UniswapSDKChainId.ARBITRUM_ONE,
  Arc = UniswapSDKChainId.ARC,
  Avalanche = UniswapSDKChainId.AVALANCHE,
  Base = UniswapSDKChainId.BASE,
  Blast = UniswapSDKChainId.BLAST,
  Bnb = UniswapSDKChainId.BNB,
  Celo = UniswapSDKChainId.CELO,
  Ink = UniswapSDKChainId.INK,
  Monad = UniswapSDKChainId.MONAD,
  Optimism = UniswapSDKChainId.OPTIMISM,
  Polygon = UniswapSDKChainId.POLYGON,
  Robinhood = UniswapSDKChainId.ROBINHOOD,
  Sepolia = UniswapSDKChainId.SEPOLIA,
  Soneium = UniswapSDKChainId.SONEIUM,
  Tempo = UniswapSDKChainId.TEMPO,
  Unichain = UniswapSDKChainId.UNICHAIN,
  UnichainSepolia = UniswapSDKChainId.UNICHAIN_SEPOLIA,
  WorldChain = UniswapSDKChainId.WORLDCHAIN,
  XLayer = UniswapSDKChainId.XLAYER,
  Linea = UniswapSDKChainId.LINEA,
  MegaETH = UniswapSDKChainId.MEGAETH,
  Zksync = UniswapSDKChainId.ZKSYNC,
  Zora = UniswapSDKChainId.ZORA,
  Solana = 501000101,
  // Inline literal (not `SUPRA_CHAIN_ID`) is required, not stylistic: a numeric
  // enum member only keeps its own literal type when initialized from another
  // literal or another enum's member (same trick `Solana` above relies on) —
  // referencing an imported `const` makes this a "computed member" typed as
  // plain `number`, which under `noUncheckedIndexedAccess` widens every
  // `Record<UniverseChainId, X>[UniverseChainId.Supra]` lookup across the
  // codebase to `X | undefined`. Keep this literal in sync with SUPRA_CHAIN_ID.
  Supra = 953497288926,
}

export enum RPCType {
  Public = 'public',
  Private = 'private',
  PublicAlt = 'public_alternative',
  Interface = 'interface',
  Fallback = 'fallback',
  Default = 'default',
}

/** Minimal chain metadata needed to select RPC URLs */
export interface RpcChainInfo {
  rpcUrls: Record<string, { http: readonly string[] }>
}

/** Chain metadata needed by the viem client factory to construct a viem Chain object */
export interface ViemChainInfo extends RpcChainInfo {
  id: number
  name: string
  nativeCurrency: { name: string; symbol: string; decimals: number }
  rpcUrls: { default: { http: readonly string[] } } & Record<string, { http: readonly string[] }>
}
