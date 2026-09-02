import { NONFUNGIBLE_POSITION_MANAGER_ADDRESSES as V3NFT_ADDRESSES } from '@uniswap/sdk-core'
import NFTPositionManagerJSON from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import { NonfungiblePositionManager } from 'uniswap/src/abis/types/v3'
import { SUPRA_NFT_POSITION_MANAGER_ADDRESS } from 'uniswap/src/features/chains/evm/info/supra'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { ContractMap, useContractMultichain } from '~/pages/PoolDetails/Pools/hooks/useContractMultichain'

// `NONFUNGIBLE_POSITION_MANAGER_ADDRESSES` is `@uniswap/sdk-core`'s own address
// map, keyed by its own `ChainId` enum — Supra was never added there (would
// require patching a third-party package) and never will be. Same pattern as
// `getV3FactoryAddress.ts`: override with this fork's own verified address.
const V3NFT_ADDRESSES_WITH_SUPRA: { [chainId: number]: string | undefined } = {
  ...V3NFT_ADDRESSES,
  [UniverseChainId.Supra]: SUPRA_NFT_POSITION_MANAGER_ADDRESS,
}

export function useV3ManagerContracts(chainIds: UniverseChainId[]): ContractMap<NonfungiblePositionManager> {
  return useContractMultichain<NonfungiblePositionManager>({
    addressMap: V3NFT_ADDRESSES_WITH_SUPRA,
    ABI: NFTPositionManagerJSON.abi,
    chainIds,
  })
}
