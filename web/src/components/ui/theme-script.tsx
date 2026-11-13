export const THEME_STORAGE_KEY = "orbit-theme";

/**
 * Script à placer dans <head> du layout racine : applique le thème AVANT le
 * premier rendu (pas de flash). Préférence enregistrée, sinon préférence système.
 * <html suppressHydrationWarning> est nécessaire (attribut data-theme ajouté).
 */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||((!p||p==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}

