import { V3_CORE_FACTORY_ADDRESSES } from '@uniswap/sdk-core'
import { SUPRA_V3_FACTORY_ADDRESS } from 'uniswap/src/features/chains/evm/info/supra'
import { UniverseChainId } from 'uniswap/src/features/chains/types'

/**
 * `V3_CORE_FACTORY_ADDRESSES` is keyed by `@uniswap/sdk-core`'s own `ChainId` enum, a
 * third-party-maintained list of Uniswap's real deployments. Supra was deliberately never
 * added to that enum (would require patching a third-party package), so it's not a valid
 * key there and never will be - indexing it directly for Supra always returns `undefined`.
 * Route Supra through this fork's own verified factory address instead.
 */
export function getV3FactoryAddress(chainId: UniverseChainId): string | undefined {
  if (chainId === UniverseChainId.Supra) {
    return SUPRA_V3_FACTORY_ADDRESS
  }
  return V3_CORE_FACTORY_ADDRESSES[chainId]
}
