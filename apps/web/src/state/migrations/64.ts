import { PersistState } from 'redux-persist'

type PersistAppState = {
  _persist: PersistState
  userSettings?: {
    isTestnetModeEnabled?: boolean
  }
}

/**
 * Turns testnet mode on for existing web users.
 *
 * `userSettings` is persisted, so changing `DEFAULT_IS_TESTNET_MODE_ENABLED` only helps
 * first-time visitors — anyone with a store from before it carries `false` forever. That
 * leaves Supra out of the enabled-chain list (it is `testnet: true`, and `getEnabledChains`
 * only keeps chains whose testnet flag matches the current mode), so every Supra
 * transaction fails at `useSelectChain`'s support check.
 *
 * Unconditional rather than only-when-false: the two states are indistinguishable here, and
 * the target value is the same either way.
 */
export const migration64 = (state: PersistAppState | undefined) => {
  if (!state) {
    return undefined
  }

  return {
    ...state,
    userSettings: {
      ...state.userSettings,
      isTestnetModeEnabled: true,
    },
    _persist: { ...state._persist, version: 64 },
  }
}
