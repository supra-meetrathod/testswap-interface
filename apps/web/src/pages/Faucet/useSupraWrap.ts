import { useEffect, useMemo, useState } from 'react'
import { SUPRA_ERC20_HANDLER_ADDRESS, SUPRA_WSUPRA_ADDRESS } from 'uniswap/src/features/chains/evm/info/supra'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { logger } from 'utilities/src/logger/logger'
import { useEvent } from 'utilities/src/react/hooks'
import { useBalance, useGasPrice, useReadContract, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import { assume0xAddress, encodeFunctionData, erc20Abi } from '~/chains'
import { getRpcProvider } from '~/constants/providers'
import { useAccount } from '~/hooks/useAccount'
import { useSelectChain } from '~/hooks/useSelectChain'
import {
  supraWrapHandlerAbi,
  WRAP_GAS_LIMIT_BUFFER_PERCENT,
  WRAP_GAS_LIMIT_FALLBACK,
  WRAP_MAX_NATIVE_GAS_RESERVE_FALLBACK_WEI,
  WRAP_MAX_RESERVE_SAFETY_MULTIPLIER,
  WrapDirection,
} from '~/pages/Faucet/constants'

/** Both native SUPRA and ERC20Supra are 18-decimal. */
export const SUPRA_DECIMALS = 18

export interface SupraWrapBalances {
  /** Native SUPRA balance in wei, undefined until loaded. */
  native: bigint | undefined
  /** ERC20Supra balance in wei, undefined until loaded. */
  wrapped: bigint | undefined
  isLoading: boolean
  refetch: () => void
}

/**
 * Reads the connected wallet's native SUPRA and ERC20Supra balances straight from the
 * chain.
 *
 * Deliberately not routed through the portfolio/balance backend: `SUPRA_CHAIN_INFO` sets
 * `backendChain.backendSupported: false` and falls its `chain` back to Ethereum, so
 * backend-sourced balances for Supra addresses come back empty. RPC reads are the only
 * source of truth here.
 */
export function useSupraWrapBalances(): SupraWrapBalances {
  const account = useAccount()
  const accountAddress = assume0xAddress(account.address)

  const {
    data: nativeBalance,
    isLoading: isNativeLoading,
    refetch: refetchNative,
  } = useBalance({
    address: accountAddress,
    chainId: UniverseChainId.Supra,
    query: { enabled: Boolean(accountAddress) },
  })

  const {
    data: wrappedBalance,
    isLoading: isWrappedLoading,
    refetch: refetchWrapped,
  } = useReadContract({
    address: assume0xAddress(SUPRA_WSUPRA_ADDRESS),
    chainId: UniverseChainId.Supra,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: accountAddress ? [accountAddress] : undefined,
    query: { enabled: Boolean(accountAddress) },
  })

  const refetch = useEvent(() => {
    refetchNative()
    refetchWrapped()
  })

  return useMemo(
    () => ({
      native: nativeBalance?.value,
      wrapped: wrappedBalance,
      isLoading: isNativeLoading || isWrappedLoading,
      refetch,
    }),
    [nativeBalance?.value, wrappedBalance, isNativeLoading, isWrappedLoading, refetch],
  )
}

/**
 * Native token to hold back when the user taps Max while wrapping, so the wrap can still
 * pay its own fee.
 *
 * Derived from the live gas price rather than a flat amount: Supra fees have been observed
 * between 333 and 667 gwei, where a single ~100k-gas wrap costs 0.03-0.07 SUPRA. A flat
 * reserve small enough to feel unobtrusive is not big enough to cover that.
 */
export function useSupraWrapMaxGasReserve(): bigint {
  const { data: gasPrice } = useGasPrice({ chainId: UniverseChainId.Supra })

  return useMemo(() => {
    if (!gasPrice) {
      return WRAP_MAX_NATIVE_GAS_RESERVE_FALLBACK_WEI
    }
    return gasPrice * WRAP_GAS_LIMIT_FALLBACK * WRAP_MAX_RESERVE_SAFETY_MULTIPLIER
  }, [gasPrice])
}

export interface SupraWrapSubmitState {
  onSubmit: () => Promise<void>
  /** Waiting for the wallet signature or for the transaction to confirm. */
  isPending: boolean
  /** Wallet signature requested but not yet granted. */
  isWaitingForWallet: boolean
  error: Error | undefined
}

/**
 * Submits a wrap (`deposit()`) or unwrap (`withdraw(amount)`) against `ERC20SupraHandler`.
 *
 * Mirrors the repo's existing submit-hook shape (chain switch -> wallet signature ->
 * confirmation -> refetch); see useSweepUnsoldTokensSubmit for the original.
 *
 * Neither direction needs an ERC-20 approval. Wrapping only sends native value, and
 * unwrapping relies on `ERC20Supra.burnFrom`, which is gated on the handler being an
 * authorized address rather than on the caller's allowance.
 */
export function useSupraWrapSubmit({
  direction,
  amount,
  onTransactionConfirmed,
}: {
  direction: WrapDirection
  /** Amount in wei, or undefined when the input is empty or unparseable. */
  amount: bigint | undefined
  onTransactionConfirmed?: () => void
}): SupraWrapSubmitState {
  const account = useAccount()
  const accountAddress = assume0xAddress(account.address)
  const selectChain = useSelectChain()
  const { sendTransactionAsync, isPending: isWaitingForWallet } = useSendTransaction()
  const [submittedTxHash, setSubmittedTxHash] = useState<`0x${string}` | undefined>(undefined)
  const [error, setError] = useState<Error | undefined>(undefined)

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: submittedTxHash,
    chainId: UniverseChainId.Supra,
    query: { enabled: Boolean(submittedTxHash) },
  })

  const handleConfirmed = useEvent(() => {
    setSubmittedTxHash(undefined)
    onTransactionConfirmed?.()
  })
  useEffect(() => {
    if (isConfirmed && submittedTxHash) {
      handleConfirmed()
    }
  }, [isConfirmed, submittedTxHash, handleConfirmed])

  const onSubmit = useEvent(async () => {
    if (!amount || amount <= 0n) {
      return
    }
    setError(undefined)
    try {
      const switched = await selectChain(UniverseChainId.Supra)
      if (!switched) {
        setError(new Error('Failed to switch networks to Supra'))
        return
      }

      const isWrap = direction === WrapDirection.Wrap
      const to = assume0xAddress(SUPRA_ERC20_HANDLER_ADDRESS)
      const data = encodeFunctionData(
        isWrap
          ? { abi: supraWrapHandlerAbi, functionName: 'deposit' }
          : { abi: supraWrapHandlerAbi, functionName: 'withdraw', args: [amount] },
      )
      const value = isWrap ? amount : 0n

      const hash = await sendTransactionAsync({
        to,
        data,
        value,
        chainId: UniverseChainId.Supra,
        // Send an explicit limit rather than letting the wallet estimate. A wallet estimate
        // under-provisioned a real wrap by 28k gas and it reverted out of gas — see
        // WRAP_GAS_LIMIT_FALLBACK's comment for the transaction.
        gas: await estimateWrapGasLimit({ from: accountAddress, to, data, value }),
      })
      setSubmittedTxHash(hash)
    } catch (e) {
      const submissionError = e instanceof Error ? e : new Error(`Failed to submit ${direction} transaction`)
      setError(submissionError)
      logger.error(submissionError, {
        tags: { file: 'useSupraWrap', function: 'onSubmit' },
        extra: { direction, amount: amount.toString() },
      })
    }
  })

  return {
    onSubmit,
    isPending: isWaitingForWallet || isConfirming,
    isWaitingForWallet,
    error,
  }
}

/**
 * Gas limit for a wrap/unwrap, estimated against Supra's node and buffered.
 *
 * Estimated here rather than left to the wallet because a wallet estimate has already
 * caused a real wrap to revert out of gas. Falls back to a fixed limit if the node cannot
 * be reached or refuses the estimate — over-provisioning costs nothing, since unused gas
 * is refunded, whereas under-provisioning burns the fee and reverts.
 */
async function estimateWrapGasLimit({
  from,
  to,
  data,
  value,
}: {
  from: `0x${string}` | undefined
  to: `0x${string}` | undefined
  data: `0x${string}`
  value: bigint
}): Promise<bigint> {
  try {
    const estimate = await getRpcProvider(UniverseChainId.Supra).estimateGas({
      from,
      to,
      data,
      value,
    })
    const buffered = (BigInt(estimate.toString()) * WRAP_GAS_LIMIT_BUFFER_PERCENT) / 100n
    return buffered > WRAP_GAS_LIMIT_FALLBACK ? buffered : WRAP_GAS_LIMIT_FALLBACK
  } catch (e) {
    logger.warn('useSupraWrap', 'estimateWrapGasLimit', 'Falling back to a fixed wrap gas limit', {
      error: e,
    })
    return WRAP_GAS_LIMIT_FALLBACK
  }
}
