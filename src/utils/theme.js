/**
 * Tema da interface (escuro/claro).
 *
 * A escolha fica em settings.theme (sincroniza entre os terminais) e é
 * espelhada em localStorage só para aplicar ANTES do React montar —
 * assim a tela não abre escura e depois "pisca" para clara.
 */
export const THEMES = { DARK: 'dark', LIGHT: 'light' };
const CACHE_KEY = 'infopdv-theme';

export function applyTheme(theme) {
  const t = theme === THEMES.LIGHT ? THEMES.LIGHT : THEMES.DARK;
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(CACHE_KEY, t); } catch { /* modo privado: ignora */ }
}

/** Chamado no boot (main.jsx), antes do primeiro render. */
export function applyCachedTheme() {
  let t = THEMES.DARK;
  try { t = localStorage.getItem(CACHE_KEY) || THEMES.DARK; } catch { /* ignora */ }
  document.documentElement.dataset.theme = t;
}
