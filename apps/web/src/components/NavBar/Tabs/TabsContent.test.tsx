import { FeatureFlags, useFeatureFlag } from '@universe/gating'
import { ElementName } from 'uniswap/src/features/telemetry/constants'
import { useTabsContent } from '~/components/NavBar/Tabs/TabsContent'
import { usePortfolioRoutes } from '~/pages/Portfolio/Header/hooks/usePortfolioRoutes'
import { PortfolioTab } from '~/pages/Portfolio/types'
import { mocked } from '~/test-utils/mocked'
import { renderHook } from '~/test-utils/render'

vi.mock('@universe/gating', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@universe/gating')>()),
  useFeatureFlag: vi.fn(),
}))

vi.mock('~/pages/Portfolio/Header/hooks/usePortfolioRoutes', () => ({
  usePortfolioRoutes: vi.fn(),
}))

// The faucet menu entry is gated on testnet mode, so tests drive it directly.
let mockIsTestnetModeEnabled = true
vi.mock('uniswap/src/features/chains/hooks/useEnabledChains', () => ({
  useEnabledChains: () => ({
    chains: [],
    gqlChains: [],
    defaultChainId: 1,
    isTestnetModeEnabled: mockIsTestnetModeEnabled,
  }),
}))

function getTabState(elementName: ElementName): boolean | undefined {
  const { result } = renderHook(() => useTabsContent())
  return result.current.find((tab) => tab.elementName === elementName)?.isActive
}

function hasDropdownItem(elementName: ElementName): boolean {
  const { result } = renderHook(() => useTabsContent())
  return result.current.some((tab) => tab.items?.some((item) => item.elementName === elementName))
}

describe('useTabsContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.pushState({}, '', '/')
    mocked(useFeatureFlag).mockImplementation((flag) => flag === FeatureFlags.PortfolioPoolsBalances)
    mocked(usePortfolioRoutes).mockReturnValue({
      tab: PortfolioTab.Overview,
      chainId: undefined,
      externalAddress: undefined,
      isExternalWallet: false,
    })
    mockIsTestnetModeEnabled = true
  })

  // The faucet dispenses tokens that only exist on Supra, a testnet chain, so outside
  // testnet mode the page has nothing to offer. The nav entry has to match the /faucet
  // route's own `enabled` guard or the menu would link to a 404.
  it('offers the faucet in the Trade menu while testnet mode is on', () => {
    expect(hasDropdownItem(ElementName.NavbarTradeDropdownFaucet)).toBe(true)
  })

  it('hides the faucet from the Trade menu when testnet mode is off', () => {
    mockIsTestnetModeEnabled = false

    expect(hasDropdownItem(ElementName.NavbarTradeDropdownFaucet)).toBe(false)
    // The rest of the Trade menu is untouched.
    expect(hasDropdownItem(ElementName.NavbarTradeDropdownSwap)).toBe(true)
  })

  it('does not light up the Trade tab on /faucet when testnet mode is off', () => {
    mockIsTestnetModeEnabled = false
    window.history.pushState({}, '', '/faucet')

    // The route is disabled there, so /faucet redirects to not-found — highlighting Trade
    // would point at a tab the user cannot reach.
    expect(getTabState(ElementName.NavbarTradeTab)).toBe(false)
  })

  it('lights up the Trade tab on /faucet while testnet mode is on', () => {
    window.history.pushState({}, '', '/faucet')

    expect(getTabState(ElementName.NavbarTradeTab)).toBe(true)
  })

  it('should keep Pool active on create-position pages without a Portfolio entry point', () => {
    window.history.pushState({}, '', '/positions/create/v4')

    expect(getTabState(ElementName.NavbarPoolTab)).toBe(true)
    expect(getTabState(ElementName.NavbarPortfolioTab)).toBe(false)
  })

  it('should make Portfolio active on create-position pages with a Portfolio Pools entry point', () => {
    window.history.pushState(
      {},
      '',
      `/positions/create/v4?${new URLSearchParams({ entryPoint: '/portfolio/pools' }).toString()}`,
    )

    expect(getTabState(ElementName.NavbarPoolTab)).toBe(false)
    expect(getTabState(ElementName.NavbarPortfolioTab)).toBe(true)
  })

  it('should make Portfolio active from a location state Portfolio Pools entry point', () => {
    window.history.pushState({ usr: { entryPoint: '/portfolio/pools' } }, '', '/positions/create/v4')

    expect(getTabState(ElementName.NavbarPoolTab)).toBe(false)
    expect(getTabState(ElementName.NavbarPortfolioTab)).toBe(true)
  })

  it('should keep Pool active when the Portfolio Pools entry point is malformed', () => {
    window.history.pushState(
      {},
      '',
      `/positions/create/v4?${new URLSearchParams({ entryPoint: '//evil.com/portfolio/pools' }).toString()}`,
    )

    expect(getTabState(ElementName.NavbarPoolTab)).toBe(true)
    expect(getTabState(ElementName.NavbarPortfolioTab)).toBe(false)
  })

  it('should keep Pool active when the Portfolio Pools entry point has an invalid address segment', () => {
    window.history.pushState(
      {},
      '',
      `/positions/create/v4?${new URLSearchParams({ entryPoint: '/portfolio/not-an-address/pools' }).toString()}`,
    )

    expect(getTabState(ElementName.NavbarPoolTab)).toBe(true)
    expect(getTabState(ElementName.NavbarPortfolioTab)).toBe(false)
  })
})
