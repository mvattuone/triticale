const supportsConstructableSheets = typeof CSSStyleSheet !== "undefined";

const boxSizingSheet = supportsConstructableSheets
  ? (() => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(`* { box-sizing: border-box; }`);
      return sheet;
    })()
  : null;

export function ensureBoxSizing(shadowRoot) {
  if (!shadowRoot) {
    return;
  }

  if (boxSizingSheet && "adoptedStyleSheets" in shadowRoot) {
    const sheets = shadowRoot.adoptedStyleSheets || [];
    if (!sheets.includes(boxSizingSheet)) {
      shadowRoot.adoptedStyleSheets = [boxSizingSheet, ...sheets];
    }
    return;
  }

  if (!shadowRoot.querySelector("style[data-box-sizing]") && typeof document !== "undefined") {
    const style = document.createElement("style");
    style.setAttribute("data-box-sizing", "true");
    style.textContent = "* { box-sizing: border-box; }";
    shadowRoot.insertBefore(style, shadowRoot.firstChild);
  }
}
