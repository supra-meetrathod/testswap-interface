import { Flex, useSporeColors } from 'ui/src'
import { GoogleChromeLogo } from 'ui/src/components/logos/GoogleChromeLogo'
import { SupraSwapMark } from '~/components/Logo/SupraSwapMark'

interface UniswapBrandedIconProps {
  size?: number
  withChromeBadge?: boolean
}

export function UniswapBrandedIcon({ size = 32, withChromeBadge }: UniswapBrandedIconProps): JSX.Element {
  const colors = useSporeColors()
  const badgeSize = Math.round(size * 0.375)
  const chromeLogoSize = badgeSize - 2
  const iconSize = size * 0.7
  return (
    <Flex
      position="relative"
      width={size}
      height={size}
      minWidth={size}
      alignItems="center"
      justifyContent="center"
      backgroundColor="$accent2"
      borderRadius="$rounded8"
    >
      <SupraSwapMark size={iconSize} color={colors.accent1.val} />
      {withChromeBadge && (
        <Flex
          position="absolute"
          bottom={-Math.round(badgeSize * 0.25)}
          right={-Math.round(badgeSize / 3)}
          width={badgeSize}
          height={badgeSize}
          borderRadius="$roundedFull"
          backgroundColor="$surface2"
          alignItems="center"
          justifyContent="center"
        >
          <GoogleChromeLogo size={chromeLogoSize} />
        </Flex>
      )}
    </Flex>
  )
}
