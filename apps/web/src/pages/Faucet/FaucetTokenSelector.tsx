import { useTranslation } from 'react-i18next'
import { Flex, Text, TouchableArea } from 'ui/src'
import { PRESS_SCALE } from 'ui/src/components/buttons/Button/components/CustomButtonFrame/constants'
import { RotatableChevron } from 'ui/src/components/icons/RotatableChevron'
import { iconSizes, spacing } from 'ui/src/theme'
import { TokenLogo } from 'uniswap/src/components/CurrencyLogo/TokenLogo'
import { Modal } from 'uniswap/src/components/modals/Modal'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { ModalName } from 'uniswap/src/features/telemetry/constants'
import { TestID } from 'uniswap/src/test/fixtures/testIDs'
import { FaucetAction, type FaucetToken } from '~/pages/Faucet/tokens'

/**
 * Token picker for the faucet.
 *
 * Follows the repo's token-selection pattern — a `DropdownButton` trigger that opens a modal
 * of choices, the same shape `CurrencySelector` + `CurrencySearchModal` use on the swap and
 * pool-finder pages. It does not reuse `CurrencySearchModal` itself because that pulls its
 * list from the backend token API, which carries no Supra entry for the bridged test tokens
 * and needs the gateway reachable; this faucet's list is fixed and known (see tokens.ts).
 */
export function FaucetTokenSelector({
  selected,
  tokens,
  onSelect,
  isOpen,
  onOpen,
  onDismiss,
}: {
  selected: FaucetToken
  /** The dispensable tokens, from `useSupraFaucetTokens`. */
  tokens: readonly FaucetToken[]
  onSelect: (token: FaucetToken) => void
  isOpen: boolean
  onOpen: () => void
  onDismiss: () => void
}): JSX.Element {
  const { t } = useTranslation()

  return (
    <>
      <TouchableArea
        testID={TestID.FaucetTokenSelector}
        backgroundColor="$surface1"
        borderRadius="$roundedFull"
        borderColor="$surface3Solid"
        borderWidth="$spacing1"
        shadowColor="$surface3"
        shadowRadius={10}
        shadowOpacity={0.04}
        scaleTo={PRESS_SCALE}
        hoverable
        hoverStyle={{ backgroundColor: '$surface1Hovered' }}
        onPress={onOpen}
      >
        <Flex centered row gap="$spacing6" px="$spacing12" height="$spacing36">
          <Flex ml={-spacing.spacing8}>
            <TokenLogo
              size={iconSizes.icon28}
              chainId={UniverseChainId.Supra}
              name={selected.name}
              symbol={selected.symbol}
            />
          </Flex>
          <Text color="$neutral1" variant="buttonLabel2">
            {selected.symbol}
          </Text>
          <RotatableChevron color="$neutral2" direction="down" size="$icon.24" mx={-spacing.spacing2} />
        </Flex>
      </TouchableArea>

      <Modal name={ModalName.FaucetTokenSelector} isModalOpen={isOpen} onClose={onDismiss} maxWidth={420}>
        <Flex gap="$gap4" p="$spacing8" width="100%">
          <Text variant="subheading1" color="$neutral1" pb="$spacing8">
            {t('tokens.selector.button.choose')}
          </Text>

          {tokens.map((token) => (
            <TouchableArea
              key={token.address}
              testID={`${TestID.FaucetTokenOption}-${token.symbol}`}
              onPress={() => {
                onSelect(token)
                onDismiss()
              }}
              row
              alignItems="center"
              gap="$gap12"
              p="$spacing12"
              borderRadius="$rounded16"
              backgroundColor={token.address === selected.address ? '$surface3' : '$transparent'}
              hoverStyle={{ backgroundColor: '$surface2' }}
            >
              <TokenLogo
                size={iconSizes.icon36}
                chainId={UniverseChainId.Supra}
                name={token.name}
                symbol={token.symbol}
              />
              <Flex fill>
                <Text variant="body2" color="$neutral1">
                  {token.symbol}
                </Text>
                <Text variant="body4" color="$neutral2">
                  {token.name}
                </Text>
              </Flex>
              {/* Only worth annotating when a token is free to mint. Both halves of the
                  native/wrapped pair cost the other half, so labelling them adds nothing —
                  and calling native SUPRA "wrapped" would be plainly wrong. */}
              {token.action === FaucetAction.Mint && (
                <Text variant="body4" color="$neutral3">
                  {t('common.free')}
                </Text>
              )}
            </TouchableArea>
          ))}
        </Flex>
      </Modal>
    </>
  )
}
