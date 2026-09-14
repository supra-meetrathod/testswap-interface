import { createTamagui } from 'ui/src'
import { animations } from 'ui/src/theme/animations'
import { configWithoutAnimations, TamaguiGroupNames } from 'ui/src/theme/config'
import { SUPRA_ACCENT } from 'ui/src/theme/webAccentOverride'

const {
  // web has specific settings (see below)
  settings: _settings,
  ...defaultConfig
} = configWithoutAnimations

export const config = createTamagui({
  ...defaultConfig,
  themes: {
    ...defaultConfig.themes,
    light: {
      ...defaultConfig.themes.light,
      ...SUPRA_ACCENT.light,
      colorHover: SUPRA_ACCENT.light.accent1,
      colorPress: SUPRA_ACCENT.light.accent1,
      colorFocus: SUPRA_ACCENT.light.accent1,
    },
    dark: {
      ...defaultConfig.themes.dark,
      ...SUPRA_ACCENT.dark,
      colorHover: SUPRA_ACCENT.dark.accent1,
      colorPress: SUPRA_ACCENT.dark.accent1,
      colorFocus: SUPRA_ACCENT.dark.accent1,
    },
  },
  animations,
  settings: {
    // leaving out allowedStyleValues - we want looser string values for most
    // styles (so you can use "1rem", "calc(...)" and other CSS goodies):
    autocompleteSpecificTokens: 'except-special',
  },
})

type Conf = typeof config

declare module '@tamagui/core' {
  // oxlint-disable-next-line typescript/no-empty-interface
  interface TamaguiCustomConfig extends Conf {}

  interface TypeOverride {
    groupNames(): TamaguiGroupNames
  }
}

export default config
