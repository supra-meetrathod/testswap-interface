import { Flex, useSporeColors } from 'ui/src'
import { GoogleChromeLogo } from 'ui/src/components/logos/GoogleChromeLogo'

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
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <path d="M12 2L21 20H15V14H9V20H3L12 2Z" fill={colors.accent1.val} />
      </svg>
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
