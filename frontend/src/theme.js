// The one setting that controls the app's look.
// Available themes are defined in src/index.css under "Themes": 'lime' | 'cyan'
export const THEME = 'lime'

export function applyTheme(theme = THEME) {
  document.documentElement.dataset.theme = theme
}
