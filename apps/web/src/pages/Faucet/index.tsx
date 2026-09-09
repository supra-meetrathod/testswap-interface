import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Flex, Text } from 'ui/src'
import { AmountInput } from 'uniswap/src/components/AmountInput/AmountInput'
import { getChainInfo } from 'uniswap/src/features/chains/chainInfo'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { useLocalizationContext } from 'uniswap/src/features/language/LocalizationContext'
import { InterfacePageName } from 'uniswap/src/features/telemetry/constants'
import Trace from 'uniswap/src/features/telemetry/Trace'
import { TestID } from 'uniswap/src/test/fixtures/testIDs'
import { areAddressesEqual } from 'uniswap/src/utils/addresses'
import { NumberType } from 'utilities/src/format/types'
import { formatUnits, parseUnits } from '~/chains'
import { useAccountDrawer } from '~/components/AccountDrawer/MiniPortfolio/hooks'
import { useAccount } from '~/hooks/useAccount'
import { WrapDirection } from '~/pages/Faucet/constants'
import { FaucetTokenSelector } from '~/pages/Faucet/FaucetTokenSelector'
import { DEFAULT_FAUCET_TOKEN, FaucetAction, type FaucetToken } from '~/pages/Faucet/tokens'
import { useSupraFaucetMint, useSupraFaucetToken } from '~/pages/Faucet/useSupraFaucetToken'
import { useSupraFaucetTokens } from '~/pages/Faucet/useSupraFaucetTokens'
import {
  SUPRA_DECIMALS,
  useSupraWrapBalances,
  useSupraWrapMaxGasReserve,
  useSupraWrapSubmit,
} from '~/pages/Faucet/useSupraWrap'

const SUPRA_INFO = getChainInfo(UniverseChainId.Supra)
/** 'SUPRA' — the native token, which is what a wrap-backed faucet spends. */
const NATIVE_SYMBOL = SUPRA_INFO.nativeCurrency.symbol

/**
 * Faucet for Supra test tokens: pick a token, enter an amount, get it.
 *
 * The only token today is WSUPRA, dispensed by wrapping the same amount of native SUPRA 1:1
 * through `ERC20SupraHandler` — so the requested amount is also the amount spent, and it is
 * validated against the wallet's native SUPRA balance.
 *
 * The dropdown stays even with a single entry: adding a token is one entry in
 * `SUPRA_FAUCET_TOKENS`, and the fixed-amount mint flow for free-to-claim tokens is still
 * wired up (see `MintPanel` and `useSupraFaucetMint`).
 */
export function FaucetPage(): JSX.Element {
  const { t } = useTranslation()
  const account = useAccount()
  const accountDrawer = useAccountDrawer()
  const { formatNumberOrString } = useLocalizationContext()

  const { tokens, isFallback } = useSupraFaucetTokens()
  const [selectedToken, setSelectedToken] = useState<FaucetToken>(DEFAULT_FAUCET_TOKEN)
  const [isSelectorOpen, setIsSelectorOpen] = useState(false)

  // The list arrives asynchronously, so the initial selection is the local default. Once the
  // API answers, adopt its entry for the same token — it carries the authoritative decimals
  // and metadata — or fall back to the first token it does offer if the default is not in it.
  useEffect(() => {
    if (tokens.length === 0) {
      return
    }
    const match = tokens.find((token) =>
      areAddressesEqual({
        addressInput1: { address: token.address, chainId: UniverseChainId.Supra },
        addressInput2: { address: selectedToken.address, chainId: UniverseChainId.Supra },
      }),
    )
    const next = match ?? tokens[0]
    if (next !== selectedToken) {
      setSelectedToken(next)
    }
  }, [tokens, selectedToken])

  const selector = (
    <FaucetTokenSelector
      selected={selectedToken}
      tokens={tokens}
      onSelect={setSelectedToken}
      isOpen={isSelectorOpen}
      onOpen={() => setIsSelectorOpen(true)}
      onDismiss={() => setIsSelectorOpen(false)}
    />
  )

  const connectButton = (
    <Button size="large" emphasis="secondary" onPress={accountDrawer.open}>
      {t('common.connectWallet.button')}
    </Button>
  )

  return (
    <Trace logImpression page={InterfacePageName.FaucetPage}>
      <Flex width="100%" maxWidth={480} py="$spacing48" px="$spacing24" gap="$spacing24" alignSelf="center">
        <Flex gap="$gap4">
          <Text variant="heading2">{t('common.faucet')}</Text>
          <Text variant="body2" color="$neutral2">
            {selectedToken.action === FaucetAction.Wrap
              ? `Choose a token and an amount to receive. ${selectedToken.symbol} is minted by wrapping the same amount of native ${NATIVE_SYMBOL} 1:1.`
              : `Claim test ${selectedToken.symbol} on Supra. The amount is fixed by the contract — you only pay gas.`}
          </Text>
        </Flex>

        {isFallback && (
          <Text variant="body4" color="$neutral3">
            Showing the built-in token list — the token list service is unavailable.
          </Text>
        )}

        {selectedToken.action === FaucetAction.Wrap ? (
          // Keyed on the token so switching resets the typed amount rather than carrying a
          // figure entered against a different token's balance.
          <WrapFaucetPanel
            key={selectedToken.address}
            selector={selector}
            isConnected={account.isConnected}
            connectButton={connectButton}
            formatNumberOrString={formatNumberOrString}
          />
        ) : (
          <MintPanel
            token={selectedToken}
            selector={selector}
            isConnected={account.isConnected}
            connectButton={connectButton}
            formatNumberOrString={formatNumberOrString}
          />
        )}
      </Flex>
    </Trace>
  )
}

type FormatNumberOrString = ReturnType<typeof useLocalizationContext>['formatNumberOrString']

/**
 * Amount-based faucet panel. The requested amount of `token` is wrapped out of the wallet's
 * native SUPRA, so it is the native balance that constrains the request.
 */
function WrapFaucetPanel({
  selector,
  isConnected,
  connectButton,
  formatNumberOrString,
}: {
  selector: JSX.Element
  isConnected: boolean
  connectButton: JSX.Element
  formatNumberOrString: FormatNumberOrString
}): JSX.Element {
  const { t } = useTranslation()
  const [inputValue, setInputValue] = useState('')

  const balances = useSupraWrapBalances()
  const maxGasReserve = useSupraWrapMaxGasReserve()
  /** Wrapping spends native SUPRA, so that is the balance a request is checked against. */
  const spendableBalance = balances.native

  // `AmountInput` normalises to a dot decimal separator and strips grouping separators,
  // so the raw value is safe to hand to `parseUnits` regardless of locale.
  const amount = useMemo(() => {
    if (!inputValue) {
      return undefined
    }
    try {
      const parsed = parseUnits(inputValue, SUPRA_DECIMALS)
      return parsed > 0n ? parsed : undefined
    } catch {
      return undefined
    }
  }, [inputValue])

  const { onSubmit, isPending, error } = useSupraWrapSubmit({
    // One-way: this page only dispenses the wrapped token. Unwrapping is still supported by
    // the hook, just not surfaced here.
    direction: WrapDirection.Wrap,
    amount,
    onTransactionConfirmed: () => {
      setInputValue('')
      balances.refetch()
    },
  })

  const hasInsufficientBalance = amount !== undefined && spendableBalance !== undefined && amount > spendableBalance

  const formatBalance = (value: bigint | undefined): string =>
    formatNumberOrString({
      value: value === undefined ? undefined : formatUnits(value, SUPRA_DECIMALS),
      type: NumberType.TokenNonTx,
    })

  const onMax = (): void => {
    if (spendableBalance === undefined) {
      return
    }
    // Hold back enough native SUPRA to pay for the faucet transaction itself, or Max would
    // request an amount that leaves nothing for gas.
    const max = spendableBalance > maxGasReserve ? spendableBalance - maxGasReserve : 0n
    setInputValue(max > 0n ? formatUnits(max, SUPRA_DECIMALS) : '')
  }

  return (
    <>
      <Flex borderRadius="$rounded20" backgroundColor="$surface2" p="$spacing20" gap="$spacing8">
        <Text variant="body3" color="$neutral2">
          {t('common.amount')}
        </Text>
        {/* Amount and token pill share a row, using the swap panel's flex recipe: the input
            is wrapped in a `fill` row and given flex={1} with no explicit width, since
            AmountInput otherwise measures and sets its own pixel width and crushes whatever
            shares the row. */}
        <Flex row alignItems="center" gap="$spacing12" minHeight="$spacing36">
          <Flex fill row flexShrink={1}>
            <AmountInput
              testID={TestID.FaucetAmountInput}
              value={inputValue}
              onChangeText={setInputValue}
              maxDecimals={SUPRA_DECIMALS}
              placeholder="0"
              placeholderTextColor="$neutral3"
              backgroundColor="$transparent"
              borderWidth="$none"
              outlineWidth={0}
              px="$none"
              py="$none"
              borderRadius={0}
              flex={1}
              fontFamily="$heading"
              fontSize={36}
              color={hasInsufficientBalance ? '$statusCritical' : '$neutral1'}
            />
          </Flex>
          <Flex row alignItems="center" flexShrink={0}>
            {selector}
          </Flex>
        </Flex>
        <Flex row alignItems="center" gap="$spacing12">
          <Text flex={1} variant="body3" color="$neutral2">
            {`${formatBalance(spendableBalance)} ${NATIVE_SYMBOL}`}
          </Text>
          <Button
            testID={TestID.FaucetMax}
            size="xxsmall"
            emphasis="secondary"
            flexGrow={0}
            flexShrink={0}
            flexBasis="auto"
            onPress={onMax}
            disabled={!spendableBalance}
          >
            {t('common.max')}
          </Button>
        </Flex>
      </Flex>

      {/* Both signals, since either on its own is easy to miss: the button goes dead and the
          reason is stated in words. */}
      {hasInsufficientBalance && (
        <Text testID={TestID.FaucetError} variant="body3" color="$statusCritical">
          {t('common.insufficientBalance.error')}
        </Text>
      )}
      {error && !hasInsufficientBalance && (
        <Text testID={TestID.FaucetError} variant="body3" color="$statusCritical">
          {t('common.wrap.failed')}
        </Text>
      )}

      {isConnected ? (
        <Button
          testID={TestID.FaucetSubmit}
          size="large"
          onPress={onSubmit}
          loading={isPending}
          disabled={!amount || hasInsufficientBalance || isPending}
        >
          {isPending ? t('common.claiming') : !amount ? t('common.noAmount.error') : t('faucet.action.get')}
        </Button>
      ) : (
        connectButton
      )}
    </>
  )
}

/**
 * Claim panel for tokens with a permissionless `faucet(address)`.
 *
 * No amount input: the contract mints a fixed amount and takes no amount argument, so an input
 * here would imply control the user does not have. No token uses this yet — it stays wired up
 * so adding a mintable test token needs no new UI.
 */
function MintPanel({
  token,
  selector,
  isConnected,
  connectButton,
  formatNumberOrString,
}: {
  token: FaucetToken
  selector: JSX.Element
  isConnected: boolean
  connectButton: JSX.Element
  formatNumberOrString: FormatNumberOrString
}): JSX.Element {
  const { t } = useTranslation()
  const { decimals, balance, refetch } = useSupraFaucetToken(token)
  const { onSubmit, isPending, error } = useSupraFaucetMint({ token, onTransactionConfirmed: refetch })

  // Decimals are read on-chain, so hold off formatting until they land rather than assuming
  // 18 and misreporting the balance by orders of magnitude.
  const formattedBalance =
    decimals === undefined || balance === undefined
      ? undefined
      : formatNumberOrString({ value: formatUnits(balance, decimals), type: NumberType.TokenNonTx })

  return (
    <>
      <Flex borderRadius="$rounded20" backgroundColor="$surface2" p="$spacing20" gap="$spacing8">
        <Text variant="body3" color="$neutral2">
          {t('explore.earn.vault.balance.tab')}
        </Text>
        <Flex row alignItems="center" gap="$spacing12" minHeight="$spacing36">
          <Text flex={1} variant="heading2" color={formattedBalance ? '$neutral1' : '$neutral3'}>
            {formattedBalance ?? '-'}
          </Text>
          <Flex row alignItems="center" flexShrink={0}>
            {selector}
          </Flex>
        </Flex>
      </Flex>

      {error && (
        <Text testID={TestID.FaucetError} variant="body3" color="$statusCritical">
          {t('common.error.general')}
        </Text>
      )}

      {isConnected ? (
        <Button testID={TestID.FaucetSubmit} size="large" onPress={onSubmit} loading={isPending} disabled={isPending}>
          {isPending ? t('common.claiming') : t('faucet.action.get')}
        </Button>
      ) : (
        connectButton
      )}
    </>
  )
}

export default FaucetPage
