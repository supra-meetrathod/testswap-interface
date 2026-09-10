import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Flex, Text } from 'ui/src'
import { AmountInput } from 'uniswap/src/components/AmountInput/AmountInput'
import { TestID } from 'uniswap/src/test/fixtures/testIDs'
import { NumberType } from 'utilities/src/format/types'
import { formatUnits, parseUnits } from '~/chains'
import { SUPRA_FAUCET_MAX_MINT_WHOLE_TOKENS } from '~/pages/Faucet/constants'
import type { FaucetToken } from '~/pages/Faucet/tokens'
import type { FormatNumberOrString } from '~/pages/Faucet/types'
import { useSupraFaucetAmountMint, useSupraFaucetToken } from '~/pages/Faucet/useSupraFaucetToken'

export function MintAmountPanel({
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
  const [inputValue, setInputValue] = useState('')

  const { decimals: onChainDecimals, balance, refetch } = useSupraFaucetToken(token)
  // `FaucetToken.decimals` is the token-list API's value and is authoritative when present;
  // the on-chain read covers the local fallback entries, which carry none. Preferring the
  // list value also means the panel is usable the moment it renders, instead of waiting on
  // an RPC round-trip that fails outright when the Supra proxy is unreachable.
  const decimals = token.decimals ?? onChainDecimals

  const amount = useMemo(() => {
    if (!inputValue || decimals === undefined) {
      return undefined
    }
    try {
      const parsed = parseUnits(inputValue, decimals)
      return parsed > 0n ? parsed : undefined
    } catch {
      return undefined
    }
  }, [inputValue, decimals])

  const { onSubmit, isPending, error } = useSupraFaucetAmountMint({
    token,
    amount,
    onTransactionConfirmed: () => {
      setInputValue('')
      refetch()
    },
  })

  // The cap is denominated in whole tokens, so it has to be scaled by this token's decimals
  // before it can be compared against a base-unit amount.
  const maxMintAmount = useMemo(
    () => (decimals === undefined ? undefined : SUPRA_FAUCET_MAX_MINT_WHOLE_TOKENS * 10n ** BigInt(decimals)),
    [decimals],
  )
  const exceedsCap = amount !== undefined && maxMintAmount !== undefined && amount > maxMintAmount

  const formattedBalance =
    decimals === undefined || balance === undefined
      ? undefined
      : formatNumberOrString({ value: formatUnits(balance, decimals), type: NumberType.TokenNonTx })

  return (
    <>
      <Flex borderRadius="$rounded20" backgroundColor="$surface2" p="$spacing20" gap="$spacing8">
        <Text variant="body3" color="$neutral2">
          {t('common.amount')}
        </Text>
        <Flex row alignItems="center" gap="$spacing12" minHeight="$spacing36">
          <Flex fill row flexShrink={1}>
            <AmountInput
              testID={TestID.FaucetAmountInput}
              value={inputValue}
              onChangeText={setInputValue}
              maxDecimals={decimals ?? 0}
              // Disabled rather than assuming 18: parsing against the wrong decimals would
              // request an amount orders of magnitude off what the user typed.
              disabled={decimals === undefined}
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
              color={exceedsCap ? '$statusCritical' : '$neutral1'}
            />
          </Flex>
          <Flex row alignItems="center" flexShrink={0}>
            {selector}
          </Flex>
        </Flex>
        <Flex row alignItems="center" gap="$spacing12">
          {/* Informational only — a mint is not spent from this balance, so it never
              constrains the amount. */}
          <Text flex={1} variant="body3" color="$neutral2">
            {`${formattedBalance ?? '-'} ${token.symbol}`}
          </Text>
          <Button
            testID={TestID.FaucetMax}
            size="xxsmall"
            emphasis="secondary"
            flexGrow={0}
            flexShrink={0}
            flexBasis="auto"
            onPress={() => setInputValue(SUPRA_FAUCET_MAX_MINT_WHOLE_TOKENS.toString())}
            disabled={decimals === undefined}
          >
            {t('common.max')}
          </Button>
        </Flex>
      </Flex>

      {exceedsCap && (
        <Text testID={TestID.FaucetError} variant="body3" color="$statusCritical">
          {`The most you can claim at once is ${SUPRA_FAUCET_MAX_MINT_WHOLE_TOKENS} ${token.symbol}.`}
        </Text>
      )}
      {error && !exceedsCap && (
        <Text testID={TestID.FaucetError} variant="body3" color="$statusCritical">
          {t('common.error.general')}
        </Text>
      )}

      {isConnected ? (
        <Button
          testID={TestID.FaucetSubmit}
          size="large"
          onPress={onSubmit}
          loading={isPending}
          disabled={!amount || exceedsCap || isPending}
        >
          {isPending ? t('common.claiming') : !amount ? t('common.noAmount.error') : t('faucet.action.get')}
        </Button>
      ) : (
        connectButton
      )}
    </>
  )
}
