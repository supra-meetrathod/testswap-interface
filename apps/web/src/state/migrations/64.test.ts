import { migration64 } from '~/state/migrations/64'

describe('migration64', () => {
  it('returns undefined when state is undefined', () => {
    expect(migration64(undefined)).toBeUndefined()
  })

  it('bumps the persisted version to 64 and turns testnet mode on', () => {
    const previousState = {
      _persist: { version: 63, rehydrated: true },
      userSettings: { isTestnetModeEnabled: false, hideSmallBalances: true },
    }
    const result: any = migration64(previousState as any)
    expect(result._persist.version).toBe(64)
    expect(result.userSettings.isTestnetModeEnabled).toBe(true)
    // Every other setting the user chose survives.
    expect(result.userSettings.hideSmallBalances).toBe(true)
  })

  it('leaves testnet mode on when it was already enabled', () => {
    const previousState = {
      _persist: { version: 63, rehydrated: true },
      userSettings: { isTestnetModeEnabled: true },
    }
    const result: any = migration64(previousState as any)
    expect(result.userSettings.isTestnetModeEnabled).toBe(true)
  })

  it('creates userSettings when the slice has never been persisted', () => {
    const previousState = { _persist: { version: 63, rehydrated: true }, user: { something: true } }
    const result: any = migration64(previousState as any)
    expect(result._persist.version).toBe(64)
    expect(result.userSettings.isTestnetModeEnabled).toBe(true)
    expect(result.user).toEqual({ something: true })
  })
})
