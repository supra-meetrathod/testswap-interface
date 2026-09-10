import { TestID } from 'uniswap/src/test/fixtures/testIDs'
import { FAUCET_BALANCE_QUERY_OPTIONS, WrapDirection } from '~/pages/Faucet/constants'
import { FaucetPage } from '~/pages/Faucet/index'
import { fireEvent, render, screen } from '~/test-utils/render'

const mockOpen = vi.fn()
vi.mock('~/components/AccountDrawer/MiniPortfolio/hooks', () => ({
  useAccountDrawer: () => ({ open: mockOpen, close: vi.fn(), isOpen: false }),
}))

let mockIsConnected = true
vi.mock('~/hooks/useAccount', () => ({
  useAccount: () => ({ isConnected: mockIsConnected, address: '0x1111111111111111111111111111111111111111' }),
}))

const mockOnSubmit = vi.fn()
const mockRefetch = vi.fn()
let mockSubmitState = { isPending: false, error: undefined as Error | undefined }
// 5 SUPRA native — the balance a request is checked against — and 2 WSUPRA already held.
let mockBalances = { native: (5n * 10n ** 18n) as bigint | undefined, wrapped: (2n * 10n ** 18n) as bigint | undefined }

// 0.2 SUPRA — stands in for gasPrice * gas limit * safety factor.
let mockGasReserve = 2n * 10n ** 17n

let mockSubmitDirection: WrapDirection | undefined

vi.mock('~/pages/Faucet/useSupraWrap', () => ({
  SUPRA_DECIMALS: 18,
  useSupraWrapBalances: () => ({ ...mockBalances, isLoading: false, refetch: mockRefetch }),
  useSupraWrapMaxGasReserve: () => mockGasReserve,
  useSupraWrapSubmit: (params: { direction: WrapDirection }) => {
    mockSubmitDirection = params.direction
    return { onSubmit: mockOnSubmit, isWaitingForWallet: false, ...mockSubmitState }
  },
}))

// The dropdown's list comes from the token-list API; mocked so the test controls it.
let mockTokenList = {
  tokens: [
    {
      address: '0xcdf5f2a6af87b04584e26aa9646b60ce1c369e55',
      symbol: 'WSUPRA',
      name: 'Wrapped Supra',
      decimals: 18,
      action: 'wrap',
    },
  ] as unknown[],
  isLoading: false,
  isFallback: false,
}
vi.mock('~/pages/Faucet/useSupraFaucetTokens', () => ({
  useSupraFaucetTokens: () => mockTokenList,
}))

// Mocked so the test never reaches wagmi. `mockTokenState` is what the token contract would
// report; the mint-amount panel reads its decimals, so tests set it per token.
let mockTokenState = { decimals: 18 as number | undefined, balance: 0n as bigint | undefined }
const mockMintOnSubmit = vi.fn()
let mockMintState = { isPending: false, error: undefined as Error | undefined }
/** Base-unit amount the page handed to the mint hook — the decimals scaling under test. */
let mockMintAmount: bigint | undefined
vi.mock('~/pages/Faucet/useSupraFaucetToken', () => ({
  useSupraFaucetToken: () => ({ ...mockTokenState, isLoading: false, refetch: vi.fn() }),
  useSupraFaucetMint: () => ({ onSubmit: vi.fn(), isPending: false, isWaitingForWallet: false, error: undefined }),
  useSupraFaucetAmountMint: (params: { amount: bigint | undefined }) => {
    mockMintAmount = params.amount
    return { onSubmit: mockMintOnSubmit, isWaitingForWallet: false, ...mockMintState }
  },
}))

/** WBTC as the token list reports it: 8 decimals, dispensed by `mint(address,uint256)`. */
const WBTC_TOKEN = {
  address: '0x66B5Fa687AA2ED10AA9bD6efeEA8A169Bb524472',
  symbol: 'WBTC',
  name: 'Wrapped Bitcoin',
  decimals: 8,
  action: 'mintAmount',
}

const amountInput = (): HTMLInputElement => screen.getByTestId(TestID.FaucetAmountInput) as HTMLInputElement
const submitButton = (): HTMLElement => screen.getByTestId(TestID.FaucetSubmit)
const enterAmount = (value: string): void => {
  fireEvent.change(amountInput(), { target: { value } })
}

describe('faucet balance query options', () => {
  // A balance is only true as of now — it changes on any transaction, including ones made
  // outside this app — so none of these reads may be served from cache.
  it('never serves a cached balance', () => {
    expect(FAUCET_BALANCE_QUERY_OPTIONS.staleTime).toBe(0)
    expect(FAUCET_BALANCE_QUERY_OPTIONS.refetchOnMount).toBe('always')
  })

  it('retains nothing once unobserved, which also blocks persistence', () => {
    // sharedDehydrateOptions.shouldDehydrateQuery returns false for gcTime === 0 before it
    // even checks meta.persist, so gcTime 0 is what keeps balances out of localStorage.
    expect(FAUCET_BALANCE_QUERY_OPTIONS.gcTime).toBe(0)
  })

  it('re-reads when the tab regains focus or the network returns', () => {
    expect(FAUCET_BALANCE_QUERY_OPTIONS.refetchOnWindowFocus).toBe(true)
    expect(FAUCET_BALANCE_QUERY_OPTIONS.refetchOnReconnect).toBe(true)
  })

  it('does not poll on a timer', () => {
    expect(FAUCET_BALANCE_QUERY_OPTIONS).not.toHaveProperty('refetchInterval')
  })
})

describe('FaucetPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsConnected = true
    mockSubmitState = { isPending: false, error: undefined }
    mockBalances = { native: 5n * 10n ** 18n, wrapped: 2n * 10n ** 18n }
    mockGasReserve = 2n * 10n ** 17n
    mockSubmitDirection = undefined
    mockTokenState = { decimals: 18, balance: 0n }
    mockMintState = { isPending: false, error: undefined }
    mockMintAmount = undefined
    mockTokenList = {
      tokens: [
        {
          address: '0xcdf5f2a6af87b04584e26aa9646b60ce1c369e55',
          symbol: 'WSUPRA',
          name: 'Wrapped Supra',
          decimals: 18,
          action: 'wrap',
        },
      ],
      isLoading: false,
      isFallback: false,
    }
  })

  it('prompts to connect when no wallet is connected', () => {
    mockIsConnected = false
    render(<FaucetPage />)

    const connect = screen.getByText('Connect wallet')
    fireEvent.click(connect)
    expect(mockOpen).toHaveBeenCalled()
  })

  it('offers WSUPRA in the dropdown', () => {
    render(<FaucetPage />)
    fireEvent.click(screen.getByTestId(TestID.FaucetTokenSelector))

    expect(screen.getByTestId(`${TestID.FaucetTokenOption}-WSUPRA`)).toBeTruthy()
  })

  it('asks for an amount before anything is entered, with the button disabled', () => {
    render(<FaucetPage />)

    expect(screen.getByText('Enter an amount')).toBeTruthy()
    expect(submitButton()).toBeDisabled()
  })

  it('enables Get faucet once an amount within balance is entered', () => {
    render(<FaucetPage />)
    enterAmount('1')

    expect(screen.getByText('Get faucet')).toBeTruthy()
    expect(submitButton()).not.toBeDisabled()
  })

  it('dispenses the token by wrapping, never unwrapping', () => {
    render(<FaucetPage />)
    enterAmount('1')
    fireEvent.click(submitButton())

    expect(mockOnSubmit).toHaveBeenCalled()
    expect(mockSubmitDirection).toBe(WrapDirection.Wrap)
  })

  it('disables the button and states the reason when the amount exceeds the SUPRA balance', () => {
    render(<FaucetPage />)
    enterAmount('999')

    expect(screen.getByTestId(TestID.FaucetError)).toBeTruthy()
    expect(screen.getByText('Insufficient balance')).toBeTruthy()
    expect(submitButton()).toBeDisabled()
  })

  it('does not submit while the amount exceeds the balance', () => {
    render(<FaucetPage />)
    enterAmount('999')
    fireEvent.click(submitButton())

    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('treats an amount exactly equal to the balance as sufficient', () => {
    render(<FaucetPage />)
    enterAmount('5')

    expect(screen.queryByTestId(TestID.FaucetError)).toBeNull()
    expect(submitButton()).not.toBeDisabled()
  })

  it('clears the error once the amount comes back within balance', () => {
    render(<FaucetPage />)
    enterAmount('999')
    expect(screen.getByTestId(TestID.FaucetError)).toBeTruthy()

    enterAmount('1')

    expect(screen.queryByTestId(TestID.FaucetError)).toBeNull()
    expect(submitButton()).not.toBeDisabled()
  })

  it('checks the request against the native SUPRA balance, not the wrapped one', () => {
    // 2 WSUPRA held but only 1 SUPRA spendable: requesting 2 must fail.
    mockBalances = { native: 1n * 10n ** 18n, wrapped: 2n * 10n ** 18n }
    render(<FaucetPage />)
    enterAmount('2')

    expect(screen.getByTestId(TestID.FaucetError)).toBeTruthy()
    expect(submitButton()).toBeDisabled()
  })

  it('holds back the gas reserve on Max, so the faucet tx can still pay for itself', () => {
    render(<FaucetPage />)
    fireEvent.click(screen.getByTestId(TestID.FaucetMax))

    // 5 SUPRA less the 0.2 reserve.
    expect(amountInput().value).toBe('4.8')
    expect(screen.queryByTestId(TestID.FaucetError)).toBeNull()
  })

  it('offers nothing for Max when the balance cannot even cover the gas reserve', () => {
    mockBalances = { native: 10n ** 17n, wrapped: 0n } // 0.1 SUPRA, reserve is 0.2
    render(<FaucetPage />)
    fireEvent.click(screen.getByTestId(TestID.FaucetMax))

    expect(amountInput().value).toBe('')
  })

  it('shows a pending label while the transaction is in flight', () => {
    mockSubmitState = { isPending: true, error: undefined }
    render(<FaucetPage />)
    enterAmount('1')

    expect(screen.getByText('Claiming')).toBeTruthy()
    expect(submitButton()).toBeDisabled()
  })

  it('surfaces a submission failure', () => {
    mockSubmitState = { isPending: false, error: new Error('boom') }
    render(<FaucetPage />)
    enterAmount('1')

    expect(screen.getByTestId(TestID.FaucetError)).toBeTruthy()
    expect(screen.getByText('Wrap failed')).toBeTruthy()
  })

  it('shows how much WSUPRA the wallet already holds', () => {
    render(<FaucetPage />)

    // 2 WSUPRA held, per mockBalances.wrapped.
    const wrappedBalance = screen.getByTestId(TestID.FaucetWrappedBalance)
    expect(wrappedBalance.textContent).toMatch(/2/)
    expect(wrappedBalance.textContent).toMatch(/WSUPRA/)
  })

  it('keeps the wrapped balance distinct from the native one it spends', () => {
    // Deliberately different figures so a mix-up between the two is visible.
    mockBalances = { native: 7n * 10n ** 18n, wrapped: 3n * 10n ** 18n }
    render(<FaucetPage />)

    // The row tied to Max is native SUPRA; the labelled line is the WSUPRA holding.
    expect(screen.getByTestId(TestID.FaucetWrappedBalance).textContent).toMatch(/3.*WSUPRA/)
    expect(screen.getByText(/7.*SUPRA/)).toBeTruthy()
  })

  it('renders a placeholder when the wrapped balance has not loaded', () => {
    mockBalances = { native: 5n * 10n ** 18n, wrapped: undefined }
    render(<FaucetPage />)

    expect(screen.getByTestId(TestID.FaucetWrappedBalance).textContent).toMatch(/WSUPRA/)
  })

  it('populates the dropdown from the token-list API', () => {
    mockTokenList = {
      tokens: [
        {
          address: '0xcdf5f2a6af87b04584e26aa9646b60ce1c369e55',
          symbol: 'WSUPRA',
          name: 'Wrapped Supra',
          decimals: 18,
          action: 'wrap',
        },
        {
          address: '0xc7143d5ba86553c06f5730c8dc9f8187a621a8d4',
          symbol: 'WETH',
          name: 'Wrapped Ether',
          decimals: 18,
          action: 'mint',
        },
      ],
      isLoading: false,
      isFallback: false,
    }
    render(<FaucetPage />)
    fireEvent.click(screen.getByTestId(TestID.FaucetTokenSelector))

    // Both entries the API returned are offered, not just the built-in one.
    expect(screen.getByTestId(`${TestID.FaucetTokenOption}-WSUPRA`)).toBeTruthy()
    expect(screen.getByTestId(`${TestID.FaucetTokenOption}-WETH`)).toBeTruthy()
  })

  it('says so when it falls back to the built-in list', () => {
    mockTokenList = { ...mockTokenList, isFallback: true }
    render(<FaucetPage />)

    expect(screen.getByText(/token list service is unavailable/)).toBeTruthy()
  })

  it('does not claim the list is complete when the API answered', () => {
    render(<FaucetPage />)

    expect(screen.queryByText(/token list service is unavailable/)).toBeNull()
  })

  // The capped-mint tokens (WBTC/WETH/sUSDC) are a different mechanism from WSUPRA's wrap:
  // `mint(address,uint256)` rather than `deposit()`, nothing spent from the user's balance,
  // and — the part that bites — decimals that are not 18.
  describe('capped-mint tokens', () => {
    const renderWithWbtc = (): void => {
      mockTokenList = { tokens: [WBTC_TOKEN], isLoading: false, isFallback: false }
      mockTokenState = { decimals: 8, balance: 0n }
      render(<FaucetPage />)
    }

    it('describes minting rather than wrapping', () => {
      renderWithWbtc()

      expect(screen.getByText(/minted straight to your wallet/)).toBeTruthy()
      expect(screen.queryByText(/wrapping the same amount/)).toBeNull()
    })

    it('scales the amount by the token decimals, not SUPRA_DECIMALS', () => {
      renderWithWbtc()
      enterAmount('1')

      // 1 WBTC at 8 decimals. Parsing with 18 would request 10^10 times too much.
      expect(mockMintAmount).toBe(10n ** 8n)
    })

    it('submits through the mint hook, never the wrap hook', () => {
      renderWithWbtc()
      // The page mounts on the WSUPRA default before the token list is adopted, so the wrap
      // hook has already run once by now. Reset the probe so what follows only reflects
      // renders where WBTC is the selection.
      mockSubmitDirection = undefined
      enterAmount('1')
      fireEvent.click(submitButton())

      expect(mockMintOnSubmit).toHaveBeenCalled()
      expect(mockOnSubmit).not.toHaveBeenCalled()
      expect(mockSubmitDirection).toBeUndefined()
    })

    it('does not gate the amount on the wallet balance, since nothing is spent', () => {
      renderWithWbtc()
      // Holding 0 WBTC and no native SUPRA, yet a claim is still valid.
      mockBalances = { native: 0n, wrapped: 0n }
      enterAmount('100')

      expect(screen.queryByTestId(TestID.FaucetError)).toBeNull()
      expect(submitButton()).not.toBeDisabled()
    })

    it('refuses an amount over the per-call cap and says the limit', () => {
      renderWithWbtc()
      enterAmount('1001')

      expect(screen.getByTestId(TestID.FaucetError)).toBeTruthy()
      expect(screen.getByText(/most you can claim at once is 1000 WBTC/)).toBeTruthy()
      expect(submitButton()).toBeDisabled()
    })

    it('accepts an amount exactly at the cap', () => {
      renderWithWbtc()
      enterAmount('1000')

      expect(screen.queryByTestId(TestID.FaucetError)).toBeNull()
      expect(submitButton()).not.toBeDisabled()
      expect(mockMintAmount).toBe(1000n * 10n ** 8n)
    })

    it('fills the cap on Max', () => {
      renderWithWbtc()
      fireEvent.click(screen.getByTestId(TestID.FaucetMax))

      expect(amountInput().value).toBe('1000')
      expect(screen.queryByTestId(TestID.FaucetError)).toBeNull()
    })

    it('uses the token list decimals without waiting on the on-chain read', () => {
      mockTokenList = { tokens: [WBTC_TOKEN], isLoading: false, isFallback: false }
      // RPC unreachable, so nothing comes back on-chain — the list's 8 still applies.
      mockTokenState = { decimals: undefined, balance: undefined }
      render(<FaucetPage />)
      enterAmount('1')

      expect(mockMintAmount).toBe(10n ** 8n)
      expect(submitButton()).not.toBeDisabled()
    })

    it('holds the amount back when neither source knows the decimals', () => {
      // A fallback-list entry carries no decimals, and the on-chain read has not landed.
      mockTokenList = {
        tokens: [{ ...WBTC_TOKEN, decimals: undefined }],
        isLoading: false,
        isFallback: true,
      }
      mockTokenState = { decimals: undefined, balance: undefined }
      render(<FaucetPage />)
      enterAmount('1')

      expect(mockMintAmount).toBeUndefined()
      expect(submitButton()).toBeDisabled()
    })

    it('surfaces a mint failure', () => {
      mockMintState = { isPending: false, error: new Error('boom') }
      renderWithWbtc()
      enterAmount('1')

      expect(screen.getByTestId(TestID.FaucetError)).toBeTruthy()
    })

    it('switches mechanism when the selection changes', () => {
      mockTokenList = {
        tokens: [
          {
            address: '0xcdf5f2a6af87b04584e26aa9646b60ce1c369e55',
            symbol: 'WSUPRA',
            name: 'Wrapped Supra',
            decimals: 18,
            action: 'wrap',
          },
          WBTC_TOKEN,
        ],
        isLoading: false,
        isFallback: false,
      }
      render(<FaucetPage />)
      expect(screen.getByText(/wrapping the same amount/)).toBeTruthy()

      fireEvent.click(screen.getByTestId(TestID.FaucetTokenSelector))
      fireEvent.click(screen.getByTestId(`${TestID.FaucetTokenOption}-WBTC`))

      expect(screen.getByText(/minted straight to your wallet/)).toBeTruthy()
    })
  })
})
