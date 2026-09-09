/**
 * Minimal ABI for `ERC20SupraHandler`'s wrap/unwrap entry points.
 *
 * Only the two functions this page calls are declared. The handler also exposes
 * `receive()` (which forwards to `deposit()`) and the UUPS/Ownable surface, none of
 * which the interface should touch.
 *
 * See SUPRA_ERC20_HANDLER_ADDRESS in
 * packages/uniswap/src/features/chains/evm/info/supra.ts for why wrapping does not
 * go through the wrapped-native token itself the way WETH9 chains do.
 */
export const supraWrapHandlerAbi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_amount', type: 'uint256' }],
    outputs: [],
  },
] as const

export enum WrapDirection {
  /** Native SUPRA -> ERC20Supra, via `deposit()`. */
  Wrap = 'wrap',
  /** ERC20Supra -> native SUPRA, via `withdraw(uint256)`. */
  Unwrap = 'unwrap',
}

/**
 * Gas limit used for wrap/unwrap when a live estimate is unavailable, and the basis for
 * sizing the Max reserve below.
 *
 * `deposit()` is not the ~21k call its calldata suggests. It makes an external call into
 * the ERC20Supra UUPS proxy, which delegatecalls `_mint`, writing a cold balance slot
 * (20k) plus `totalSupply`, and emitting both `Transfer` and `Deposit`. Measured against
 * Supra's own node via `eth_estimateGas`: **98,427** for a first mint.
 *
 * This matters because a wallet-supplied estimate already failed a real wrap in
 * production: tx 0xfcb85e89…81ffe was sent with a 70,305 limit, burned 68,673 (97.7% of
 * it) and reverted with empty revert data — a 28,122 gas shortfall against the node's own
 * figure. Replaying the identical call through `eth_call` succeeds, so the contract logic
 * was never at fault. Over-provisioning the limit is free: unused gas is refunded.
 */
export const WRAP_GAS_LIMIT_FALLBACK = 200_000n

/** Percentage applied to a live gas estimate before it is sent as the limit. */
export const WRAP_GAS_LIMIT_BUFFER_PERCENT = 150n

/**
 * Safety multiplier on `gasPrice * WRAP_GAS_LIMIT_FALLBACK` when reserving native token
 * for the Max button, so a price rise between quoting Max and signing doesn't leave the
 * wrap unable to pay for itself.
 */
export const WRAP_MAX_RESERVE_SAFETY_MULTIPLIER = 2n

/**
 * Native reserve used for Max when `eth_gasPrice` is unavailable.
 *
 * Sized off observed Supra fee levels (333–667 gwei), not a guess: 200,000 gas at 667
 * gwei is ~0.133 SUPRA, so 0.3 leaves headroom. The previous value here was 0.01 SUPRA,
 * which was ~6x too small to cover a single wrap and would have left a Max wrap unable to
 * pay its own fee.
 */
export const WRAP_MAX_NATIVE_GAS_RESERVE_FALLBACK_WEI = 3n * 10n ** 17n // 0.3 SUPRA

/**
 * Minimal ABI for the bridged test tokens' permissionless mint.
 *
 * `faucet(address to)` mints a fixed amount — set by the contract, with no amount
 * parameter — to the address passed in. That is why the faucet UI hides the amount input
 * for these tokens: an input the contract ignores would misrepresent what happens.
 */
export const supraFaucetMintAbi = [
  {
    type: 'function',
    name: 'faucet',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [],
  },
] as const

/**
 * Gas limit for `faucet(address)` when a live estimate is unavailable.
 *
 * Same reasoning as WRAP_GAS_LIMIT_FALLBACK: a mint writes a cold balance slot plus
 * `totalSupply` and emits a Transfer, so it is nowhere near a bare 21k transfer, and a
 * wallet estimate has already under-provisioned a real transaction on this chain. Unused
 * gas is refunded, so over-provisioning is free.
 */
export const MINT_GAS_LIMIT_FALLBACK = 200_000n
