import { createTamagui } from 'tamagui'
import { animations } from 'ui/src/theme/animations'
import { configWithoutAnimations } from 'ui/src/theme/config'
import { SUPRA_ACCENT } from 'ui/src/theme/webAccentOverride'

export type { TamaguiGroupNames } from 'ui/src/theme/config'

export const config = createTamagui({
  animations,
  ...configWithoutAnimations,
  themes: {
    ...configWithoutAnimations.themes,
    light: {
      ...configWithoutAnimations.themes.light,
      ...SUPRA_ACCENT.light,
      colorHover: SUPRA_ACCENT.light.accent1,
      colorPress: SUPRA_ACCENT.light.accent1,
      colorFocus: SUPRA_ACCENT.light.accent1,
    },
    dark: {
      ...configWithoutAnimations.themes.dark,
      ...SUPRA_ACCENT.dark,
      colorHover: SUPRA_ACCENT.dark.accent1,
      colorPress: SUPRA_ACCENT.dark.accent1,
      colorFocus: SUPRA_ACCENT.dark.accent1,
    },
  },
})

export default config
