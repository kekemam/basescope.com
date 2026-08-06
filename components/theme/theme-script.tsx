import Script from "next/script";

const STORAGE_KEY = "basescope:theme";

const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    document.documentElement.setAttribute("data-theme", stored === "light" ? "light" : "dark");
  } catch (e) {}
})();
`;

/**
 * Corre antes da hidratação para aplicar o tema guardado sem flash de
 * conteúdo (FOUC) — ver components/theme/theme-toggle.tsx para quem escreve
 * em localStorage.
 */
export function ThemeScript() {
  return (
    // A regra do plugin do Next assume Pages Router (pages/_document.js) — em
    // App Router, colocar beforeInteractive no root layout é o padrão oficial.
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script id="theme-init" strategy="beforeInteractive">
      {THEME_SCRIPT}
    </Script>
  );
}
