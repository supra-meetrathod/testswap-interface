import { TestID } from 'uniswap/src/test/fixtures/testIDs'
import { WrapDirection } from '~/pages/Faucet/constants'
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

// No token uses the mint flow yet, but the page still imports its hooks — mocked so the test
// never reaches wagmi.
vi.mock('~/pages/Faucet/useSupraFaucetToken', () => ({
  useSupraFaucetToken: () => ({ decimals: 18, balance: 0n, isLoading: false, refetch: vi.fn() }),
  useSupraFaucetMint: () => ({ onSubmit: vi.fn(), isPending: false, isWaitingForWallet: false, error: undefined }),
}))

const amountInput = (): HTMLInputElement => screen.getByTestId(TestID.FaucetAmountInput) as HTMLInputElement
const submitButton = (): HTMLElement => screen.getByTestId(TestID.FaucetSubmit)
const enterAmount = (value: string): void => {
  fireEvent.change(amountInput(), { target: { value } })
}

describe('FaucetPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsConnected = true
    mockSubmitState = { isPending: false, error: undefined }
    mockBalances = { native: 5n * 10n ** 18n, wrapped: 2n * 10n ** 18n }
    mockGasReserve = 2n * 10n ** 17n
    mockSubmitDirection = undefined
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
})
