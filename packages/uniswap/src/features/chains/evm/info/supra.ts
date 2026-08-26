import { Token } from '@uniswap/sdk-core'
import { GraphQLApi } from '@universe/api'
import { SUPRA_LOGO } from 'ui/src/assets'
import { WEB_ONLY_CHAIN_SUPPORTED_APPS } from 'uniswap/src/features/chains/chainAppSupport'
import { CHAIN_ID_TO_URL_PARAM } from 'uniswap/src/features/chains/chainUrlParam'
import { DEFAULT_MS_BEFORE_WARNING, DEFAULT_NATIVE_ADDRESS } from 'uniswap/src/features/chains/evm/rpc'
import { buildChainTokens } from 'uniswap/src/features/chains/evm/tokens'
import { GENERIC_L2_GAS_CONFIG } from 'uniswap/src/features/chains/gasDefaults'
import {
  GqlChainId,
  NetworkLayer,
  RPCType,
  UniverseChainId,
  UniverseChainInfo,
} from 'uniswap/src/features/chains/types'
import { Platform } from 'uniswap/src/features/platforms/types/Platform'
import { ElementName } from 'uniswap/src/features/telemetry/constants'

// Single source of truth for Supra-specific constants — import these instead
// of re-typing raw values elsewhere in the system (rpc.ts, addresses.ts,
// tests, patches, etc.). `UniverseChainId.Supra` (in types.ts) is itself the
// canonical chain-ID constant, same as every other chain in that enum.

// Confirmed non-standard RPC (subgraph/plan.md, Phase 2 Step 1): tx-hash
// lookups only resolve via a non-standard `indexing_hash` field, eth_getLogs
// is capped at 100 blocks, eth_call only works at block tag "latest". The
// indexer works around this with a proxy (subgraph/graph-node-supra/rpc-proxy/proxy.py)
// that isn't deployed anywhere the frontend can reach yet — swap this for that
// proxy's URL before shipping swap/send flows on Supra (see todo.md).
// Origin is also allow-listed in apps/web/public/dev-csp.json connectSrc — keep in sync if this changes.
export const SUPRA_RPC_URL = 'http://91.134.205.161:27001/rpc/v1/eth'

// Confirmed live on Supra (subgraph/plan.md, Phase 2 Step 3 end-to-end test): a
// pool was created, a position minted, and a swap executed against these
// addresses. Only the Factory address is documented anywhere — the others
// (NonfungiblePositionManager/SwapRouter02/QuoterV2/Multicall/Permit2) are
// known to exist but their addresses still need to be recovered (see todo.md
// § Contract addresses) before this chain can support swaps in the frontend.
export const SUPRA_V3_FACTORY_ADDRESS = '0xC362cE6BE438Aa04b8fCd8f4D057Ba28dcC4Cbb0'
export const SUPRA_WSUPRA_ADDRESS = '0xcdf5f2a6af87b04584e26aa9646b60ce1c369e55'
export const SUPRA_BRIDGED_WETH_ADDRESS = '0xc7143d5ba86553c06f5730c8dc9f8187a621a8d4'
export const SUPRA_BRIDGED_WBTC_ADDRESS = '0x8fc8cfb7f7362e44e472c690a6e025b80e406458'

// No stablecoin exists on Supra yet and no stable pool has been created.
// Using WSUPRA itself as the sole "stablecoin" entry mirrors the fallback the
// self-hosted subgraph already adopted (subgraph/v3-subgraph/config/supra/chain.ts:
// STABLE_TOKEN_POOL = REFERENCE_TOKEN, "reference token's USD price is 1 by
// definition" until a real stable pair pool exists). Replace once a real
// stablecoin is deployed and paired.
const tokens = buildChainTokens({
  stables: {
    WSUPRA: new Token(UniverseChainId.Supra, SUPRA_WSUPRA_ADDRESS, 18, 'WSUPRA', 'Wrapped Supra'),
  },
  primaryStablecoin: 'WSUPRA',
})

export const SUPRA_CHAIN_INFO = {
  id: UniverseChainId.Supra,
  platform: Platform.EVM,
  // Web-only until wallet (mobile/extension) support for Supra is verified.
  supportedApps: WEB_ONLY_CHAIN_SUPPORTED_APPS,
  // Not confirmed mainnet vs. testnet — treated as testnet for now so it stays
  // out of GQL_MAINNET_CHAINS and behind the app's testnet-mode toggle until
  // confirmed otherwise (open question, see todo.md).
  testnet: true,
  assetRepoNetworkName: undefined,
  backendChain: {
    // Uniswap's backend GraphQL schema has no Supra entry (see
    // packages/api/src/clients/graphql/__generated__/schema-types.ts) and this
    // field is required (no "unsupported" value exists in the type). Falls
    // back to Ethereum's enum value; call sites that read `.backendChain.chain`
    // unconditionally (Explore, TokenDetails, PoolDetails, price charts — see
    // todo.md § Backend/API dependency) will therefore query Uniswap's real
    // Ethereum backend for a Supra address, which will almost always just
    // return "not found" since Supra contract addresses aren't Ethereum
    // addresses — but this is a real gap, not a safe no-op. Don't treat
    // `backendSupported: false` below as sufficient gating on its own.
    chain: GraphQLApi.Chain.Ethereum as GqlChainId,
    backendSupported: false,
    nativeTokenBackendAddress: undefined,
  },
  blockPerMainnetEpochForChainId: 1,
  blockWaitMsBeforeWarning: DEFAULT_MS_BEFORE_WARNING,
  bridge: undefined, // TODO(SUPRA): fill in once a canonical bridge URL is confirmed.
  docs: 'https://docs.supra.com/',
  elementName: ElementName.ChainSupra,
  explorer: {
    name: 'Suprascan',
    url: 'https://multivm.suprascan.io/',
  },
  interfaceName: 'supra',
  label: 'Supra',
  logo: SUPRA_LOGO,
  name: 'Supra',
  nativeCurrency: {
    name: 'Supra',
    symbol: 'SUPRA',
    decimals: 18,
    address: DEFAULT_NATIVE_ADDRESS,
    logo: SUPRA_LOGO,
  },
  networkLayer: NetworkLayer.L1,
  pendingTransactionsRetryOptions: undefined,
  rpcUrls: {
    [RPCType.Default]: { http: [SUPRA_RPC_URL] },
    [RPCType.Interface]: { http: [SUPRA_RPC_URL] },
    // No QuickNode/UniRPC support exists for Supra (one RPC node total, see
    // todo.md § RPC providers) — same raw URL as Default/Interface. Required:
    // every other EVM chain declares this key, and ORDERED_EVM_CHAINS.map(c
    // => c.rpcUrls)'s inferred type is a union of each chain's literal
    // rpcUrls shape, not the general (fully-optional) interface — omitting
    // it here broke `chain.rpcUrls[RPCType.Public]` typechecking for every
    // chain, not just this one (publicRpcUnirpc.test.ts).
    [RPCType.Public]: { http: [SUPRA_RPC_URL] },
  },
  supportedURVersions: [],
  supportsV4: false,
  supportsNFTs: false,
  urlParam: CHAIN_ID_TO_URL_PARAM[UniverseChainId.Supra],
  tokens,
  wrappedNativeCurrency: {
    name: 'Wrapped Supra',
    symbol: 'WSUPRA',
    decimals: 18,
    address: SUPRA_WSUPRA_ADDRESS,
  },
  gasConfig: GENERIC_L2_GAS_CONFIG,
  tradingApiPollingIntervalMs: 1000,
} as const satisfies UniverseChainInfo
