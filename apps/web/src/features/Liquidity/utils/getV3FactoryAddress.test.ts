import { V3_CORE_FACTORY_ADDRESSES } from '@uniswap/sdk-core'
import { SUPRA_V3_FACTORY_ADDRESS } from 'uniswap/src/features/chains/evm/info/supra'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { getV3FactoryAddress } from '~/features/Liquidity/utils/getV3FactoryAddress'

describe('getV3FactoryAddress', () => {
  it('returns the fork-known factory address for Supra', () => {
    expect(getV3FactoryAddress(UniverseChainId.Supra)).toBe(SUPRA_V3_FACTORY_ADDRESS)
  })

  it('does not fall through to the sdk-core map for Supra', () => {
    expect(V3_CORE_FACTORY_ADDRESSES[UniverseChainId.Supra]).toBeUndefined()
  })

  it('falls through to the sdk-core map for a real sdk-core chain', () => {
    expect(getV3FactoryAddress(UniverseChainId.Mainnet)).toBe(V3_CORE_FACTORY_ADDRESSES[UniverseChainId.Mainnet])
  })
})
