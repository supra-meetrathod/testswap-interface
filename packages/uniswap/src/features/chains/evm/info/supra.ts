import { Token } from '@uniswap/sdk-core'
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
// is capped at 100 blocks, eth_call only works at block tag "latest".
// Routed through supraswap-gateway-service's own /rpc/:chainId proxy
// (src/rpc/proxy.ts), which already applies these fixes for reads and is
// the only thing the wallet can actually reach right now — pointing this at
// the raw node directly (http://91.134.205.161:27001/rpc/v1/eth) made the
// wallet's own eth_sendTransaction broadcast fail with a generic -32603
// "Internal JSON-RPC error" for the create-position flow, since MetaMask's
// SDK talks to whatever's in rpcUrls straight from the extension, bypassing
// SUPRA_BACKEND_URL entirely. Swap this for a real deployed proxy URL before
// shipping outside local dev (see todo.md's RPC blocker).
// Origin is derived from SUPRA_BACKEND_URL and auto-allow-listed by
// apps/web/vite/vite.plugins.ts's CSP wiring — no dev-csp.json edit needed.
// For local development prefer localhost proxy (CSP allows http://localhost:3021).
// In production replace this with the deployed proxy origin.
export const SUPRA_RPC_URL = 'http://localhost:3021/rpc/953497288926'

// Confirmed live on Supra (subgraph/plan.md, Phase 2 Step 3 end-to-end test): a
// pool was created, a position minted, and a swap executed against these
// addresses. Full V3 periphery set (Factory/NonfungiblePositionManager/
// SwapRouter02/QuoterV2) recovered and verified live via `eth_getCode` — see
// `frontend/todo.md` § 2 and `supraswap-gateway-service/src/config/config.ts`'s
// `SUPRA_V3_ADDRESSES` (same values, gateway-side copy). Two addresses this
// fork still has no real deployment for: Uniswap's own `UniswapInterfaceMulticall`
// (distinct from generic Multicall2/3 — never deployed on Supra, not part of
// the recovered set) and Permit2 (confirmed NOT deployed — canonical
// deterministic address has empty bytecode).
export const SUPRA_V3_FACTORY_ADDRESS = '0xC362cE6BE438Aa04b8fCd8f4D057Ba28dcC4Cbb0'
export const SUPRA_NFT_POSITION_MANAGER_ADDRESS = '0x1AE137CB337966885929ed412119B4b9669a7170'
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
    // Uniswap's real backend GraphQL schema has no Supra entry (this field's
    // real type, `GqlChainId`, has no "unsupported" value) — but this fork
    // never calls that real backend for Supra: `SUPRA_BACKEND_URL` routes
    // every GraphQL/Connect call to `supraswap-gateway-service` instead, and
    // that gateway's own `schema.graphql` deliberately adds `SUPRA` to its
    // copy of the `Chain` enum (see its header comment, and
    // `fromGraphQLChain`'s matching `case 'SUPRA'` below in this same repo's
    // `utils.ts`). So `'SUPRA'` is the correct real value here, not a
    // placeholder — call sites that read `.backendChain.chain` unconditionally
    // (Explore, TokenDetails, PoolDetails, price charts) get a value the
    // gateway actually understands. Previously fell back to
    // `GraphQLApi.Chain.Ethereum`, which silently sent every such pool/token
    // link to `/explore/pools/ethereum/...` — crashing PoolDetails downstream
    // (no Ethereum V3 factory config in this fork) — confirmed live via
    // `toGraphQLChain(UniverseChainId.Supra)` returning `'ETHEREUM'` before
    // this fix. `GqlChainId`'s real type doesn't include this literal (it's
    // `Exclude<GraphQLApi.Chain, ...>`, the real enum), hence the cast — same
    // cast this line already carried for the old placeholder value.
    chain: 'SUPRA' as GqlChainId,
    // Must be `true`, not just `chain` above being correct: `isBackendSupportedChain()`
    // (packages/uniswap/src/features/chains/utils.ts) gates on this flag BEFORE
    // ever calling `fromGraphQLChain()` — with it `false`, `apps/web/src/data/chainUtils.ts`'s
    // `supportedChainIdFromGQLChain()` (used by e.g. the Explore Pools table to
    // build each row's pool-detail link) short-circuits to `undefined` regardless
    // of `chain` being right, silently falling back to the app's default chain
    // (Ethereum) — confirmed live: fixing only `chain` above, without this, left
    // the exact same "/explore/pools/ethereum/..." bug in place. `false` was
    // correct before this gateway existed (no backend to call at all); this
    // fork's `supraswap-gateway-service` genuinely does serve Supra now — see
    // the `chain` comment above — so `true` reflects current reality, not a
    // guess. `GQL_TESTNET_CHAINS` will start including Supra as a side effect
    // (this chain is `testnet: true` above) — intended, since chain-list
    // queries built from that list already exclusively hit this fork's own
    // gateway once `SUPRA_BACKEND_URL` is set (see gateway PLAN.md's "Frontend
    // env wiring" section), same as every other backend call this fork makes.
    backendSupported: true,
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
