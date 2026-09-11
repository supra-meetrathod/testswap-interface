import { SVGProps } from 'react'
import { Flex, styled, useSporeColors } from 'ui/src'

function Logo({ color, onClick }: { color: string; onClick?: () => void }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      onClick={onClick}
      cursor="pointer"
    >
      <path d="M12 2L21 20H15V14H9V20H3L12 2Z" fill={color} />
    </svg>
  )
}

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
      <Logo color={colors.accent1.val} onClick={onClick} />
    </Container>
  )
}
