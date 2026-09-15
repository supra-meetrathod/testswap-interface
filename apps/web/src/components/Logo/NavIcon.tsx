import { SVGProps } from 'react'
import { Flex, styled, useSporeColors } from 'ui/src'
import { SupraSwapMark } from '~/components/Logo/SupraSwapMark'

const Container = styled(Flex, {
  position: 'relative',
  justifyContent: 'center',
  alignItems: 'center',
  cursor: 'auto',
  variants: {
    clickable: {
      true: { cursor: 'pointer' },
    },
  },
})

type NavIconProps = SVGProps<SVGSVGElement> & {
  clickable?: boolean
  onClick?: () => void
}

export const NavIcon = ({ clickable, onClick }: NavIconProps) => {
  const colors = useSporeColors()

  return (
    <Container clickable={clickable}>
      <SupraSwapMark size={22} color={colors.accent1.val} onClick={onClick} cursor="pointer" />
    </Container>
  )
}
