import { useEffect, useMemo, useState } from 'react'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { logger } from 'utilities/src/logger/logger'
import { useEvent } from 'utilities/src/react/hooks'
import { useReadContract, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import { assume0xAddress, encodeFunctionData, erc20Abi } from '~/chains'
import { getRpcProvider } from '~/constants/providers'
import { useAccount } from '~/hooks/useAccount'
import { useSelectChain } from '~/hooks/useSelectChain'
import {
  FAUCET_BALANCE_QUERY_OPTIONS,
  MINT_GAS_LIMIT_FALLBACK,
  supraFaucetAmountMintAbi,
  supraFaucetMintAbi,
  WRAP_GAS_LIMIT_BUFFER_PERCENT,
} from '~/pages/Faucet/constants'
import type { FaucetToken } from '~/pages/Faucet/tokens'

export interface FaucetTokenState {
  /** On-chain decimals. Undefined until read — never assumed. */
  decimals: number | undefined
  /** The connected wallet's balance in base units. */
  balance: bigint | undefined
  isLoading: boolean
  refetch: () => void
}

/**
 * Reads the selected faucet token's decimals and the connected wallet's balance of it.
 *
 * Decimals are read rather than declared because only WSUPRA's 18 is verified on-chain; the
 * bridged WETH/WBTC deployments are separate contracts whose decimals nobody has confirmed,
 * and guessing wrong would silently misreport every balance by orders of magnitude.
 */
export function useSupraFaucetToken(token: FaucetToken): FaucetTokenState {
  const account = useAccount()
  const accountAddress = assume0xAddress(account.address)
  const tokenAddress = assume0xAddress(token.address)

  const { data: decimals, isLoading: isDecimalsLoading } = useReadContract({
    address: tokenAddress,
    chainId: UniverseChainId.Supra,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { staleTime: Infinity, gcTime: Infinity },
  })

  const {
    data: balance,
    isLoading: isBalanceLoading,
    refetch: refetchBalance,
  } = useReadContract({
    address: tokenAddress,
    chainId: UniverseChainId.Supra,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: accountAddress ? [accountAddress] : undefined,
    query: { enabled: Boolean(accountAddress), ...FAUCET_BALANCE_QUERY_OPTIONS },
  })

  const refetch = useEvent(() => {
    refetchBalance()
  })

  return useMemo(
    () => ({
      decimals,
      balance,
      isLoading: isDecimalsLoading || isBalanceLoading,
      refetch,
    }),
    [decimals, balance, isDecimalsLoading, isBalanceLoading, refetch],
  )
}

export interface FaucetMintState {
  onSubmit: () => Promise<void>
  isPending: boolean
  isWaitingForWallet: boolean
  error: Error | undefined
}

/**
 * Submits `faucet(address)` on a bridged test token, minting its fixed amount to the
 * connected wallet.
 *
 * Same submit shape as the wrap flow: switch chain, send with an explicit gas limit, wait
 * for the receipt, then let the caller refetch.
 */
export function useSupraFaucetMint({
  token,
  onTransactionConfirmed,
}: {
  token: FaucetToken
  onTransactionConfirmed?: () => void
}): FaucetMintState {
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
    if (!accountAddress) {
      return
    }
    setError(undefined)
    try {
      const switched = await selectChain(UniverseChainId.Supra)
      if (!switched) {
        setError(new Error('Failed to switch networks to Supra'))
        return
      }

      const to = assume0xAddress(token.address)
      // `faucet` mints to its argument, so the recipient is the sender.
      const data = encodeFunctionData({
        abi: supraFaucetMintAbi,
        functionName: 'faucet',
        args: [accountAddress],
      })

      const hash = await sendTransactionAsync({
        to,
        data,
        chainId: UniverseChainId.Supra,
        gas: await estimateMintGasLimit({ from: accountAddress, to, data }),
      })
      setSubmittedTxHash(hash)
    } catch (e) {
      const submissionError = e instanceof Error ? e : new Error(`Failed to mint ${token.symbol}`)
      setError(submissionError)
      logger.error(submissionError, {
        tags: { file: 'useSupraFaucetToken', function: 'useSupraFaucetMint' },
        extra: { token: token.address, symbol: token.symbol },
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
 * Submits `mint(address,uint256)` on a capped-mint faucet token, minting `amount` to the
 * connected wallet.
 */
export function useSupraFaucetAmountMint({
  token,
  amount,
  onTransactionConfirmed,
}: {
  token: FaucetToken
  /** Amount in base units, or undefined when the input is empty or unparseable. */
  amount: bigint | undefined
  onTransactionConfirmed?: () => void
}): FaucetMintState {
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
    if (!accountAddress || !amount || amount <= 0n) {
      return
    }
    setError(undefined)
    try {
      const switched = await selectChain(UniverseChainId.Supra)
      if (!switched) {
        setError(new Error('Failed to switch networks to Supra'))
        return
      }

      const to = assume0xAddress(token.address)
      // `mint` credits its first argument, so the recipient is the sender.
      const data = encodeFunctionData({
        abi: supraFaucetAmountMintAbi,
        functionName: 'mint',
        args: [accountAddress, amount],
      })

      const hash = await sendTransactionAsync({
        to,
        data,
        chainId: UniverseChainId.Supra,
        gas: await estimateMintGasLimit({ from: accountAddress, to, data }),
      })
      setSubmittedTxHash(hash)
    } catch (e) {
      const submissionError = e instanceof Error ? e : new Error(`Failed to mint ${token.symbol}`)
      setError(submissionError)
      logger.error(submissionError, {
        tags: { file: 'useSupraFaucetToken', function: 'useSupraFaucetAmountMint' },
        extra: { token: token.address, symbol: token.symbol, amount: amount.toString() },
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
 * Gas limit for either mint call, estimated against Supra's node and buffered, falling back
 * to a fixed limit when the node can't be reached. Mirrors `estimateWrapGasLimit`.
 *
 * Shared by `faucet(address)` and `mint(address,uint256)`: both write a cold balance slot
 * plus `totalSupply` and emit a Transfer, so they cost the same order of gas.
 */
async function estimateMintGasLimit({
  from,
  to,
  data,
}: {
  from: `0x${string}` | undefined
  to: `0x${string}` | undefined
  data: `0x${string}`
}): Promise<bigint> {
  try {
    const estimate = await getRpcProvider(UniverseChainId.Supra).estimateGas({ from, to, data })
    const buffered = (BigInt(estimate.toString()) * WRAP_GAS_LIMIT_BUFFER_PERCENT) / 100n
    return buffered > MINT_GAS_LIMIT_FALLBACK ? buffered : MINT_GAS_LIMIT_FALLBACK
  } catch (e) {
    logger.warn('useSupraFaucetToken', 'estimateMintGasLimit', 'Falling back to a fixed mint gas limit', { error: e })
    return MINT_GAS_LIMIT_FALLBACK
  }
}
