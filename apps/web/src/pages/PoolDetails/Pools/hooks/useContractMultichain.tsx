import { BaseContract } from '@ethersproject/contracts'
import { useWeb3React } from '@web3-react/core'
import { useMemo } from 'react'
import { useIsSupportedChainIdCallback } from 'uniswap/src/features/chains/hooks/useSupportedChainId'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { isEVMChain } from 'uniswap/src/features/platforms/utils/chains'
import { getContract } from 'utilities/src/contracts/getContract'
import { getRpcProvider } from '~/constants/providers'
import { useAccount } from '~/hooks/useAccount'

export type ContractMap<T extends BaseContract> = { [key: number]: T }

// Constructs a chain-to-contract map, using the wallet's provider when available
export function useContractMultichain<T extends BaseContract>({
  addressMap,
  ABI,
  chainIds,
}: {
  addressMap: { [chainId: number]: string | undefined }
  ABI: any
  chainIds?: UniverseChainId[]
}): ContractMap<T> {
  const account = useAccount()
  const { provider: walletProvider } = useWeb3React()
  const isSupportedChain = useIsSupportedChainIdCallback()

  return useMemo(() => {
    const relevantChains =
      chainIds ??
      Object.keys(addressMap)
        .map((chainId) => parseInt(chainId))
        .filter((chainId) => isSupportedChain(chainId))

    return relevantChains.reduce((acc: ContractMap<T>, chainId) => {
      const isSupported = isSupportedChain(chainId) && isEVMChain(chainId)
      // Some chains genuinely have no real deployment for a given contract
      // (e.g. Supra has no Uniswap-own Multicall deployment) — skip rather
      // than construct a contract instance at an empty/guessed address,
      // which throws (`getContract`'s `Invalid 'address' parameter`).
      const address = addressMap[chainId]
      if (!address) {
        return acc
      }

      const provider =
        walletProvider && account.chainId === chainId
          ? walletProvider
          : isSupported
            ? getRpcProvider(chainId)
            : undefined
      if (provider) {
        acc[chainId] = getContract({ address, ABI, provider }) as T
      }
      return acc
    }, {})
  }, [ABI, addressMap, chainIds, isSupportedChain, account.chainId, walletProvider])
}
