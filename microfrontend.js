import { App } from "./App.js";
import templateHtml from "./index.html";
import styles from "./styles.css";
import { setPublicPath } from "./helpers/setPublicPath.js";
import { makeAbsoluteUrl } from "./helpers/makeAbsoluteUrl.js";

let templateString = null;
let appInitialized = false;
let cachedImportMap = undefined;
const EMPTY_IMPORT_MAP = Object.freeze({ imports: {} });

const ABSOLUTE_URL_PATTERN = /^(?:[a-z]+:|\/\/|data:|blob:|#)/i;
const IMPORTMAP_PATTERN = /<script\s+type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i;

let publicPath = new URL("./", import.meta.url).href;
setPublicPath(publicPath);

function ensureApp() {
  if (!appInitialized) {
    App();
    appInitialized = true;
  }
}

function getTemplateFragment(root) {
  if (templateString === null) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(templateHtml, "text/html");
    const rootEl = doc.querySelector(root);
    if (!rootEl) {
      throw new Error(`Unable to locate ${root} in in index.html template`);
    }

    templateString = rootEl.outerHTML + getImportMapMarkup();
  }

  const template = document.createElement("template");
  template.innerHTML = templateString;
  return template.content.cloneNode(true);
}

function parseImportMapFromTemplate() {
  if (cachedImportMap !== undefined) {
    return cachedImportMap;
  }

  const match = templateHtml.match(IMPORTMAP_PATTERN);

  if (!match || !match[1]) {
    cachedImportMap = EMPTY_IMPORT_MAP;
    return cachedImportMap;
  }

  try {
    cachedImportMap = JSON.parse(match[1]);
  } catch (error) {
    console.warn("Failed to parse importmap from index.html", error);
    cachedImportMap = EMPTY_IMPORT_MAP;
  }

  return cachedImportMap;
}

function getImportMapMarkup() {
  const parsedImportMap = parseImportMapFromTemplate();

  if (!parsedImportMap || parsedImportMap === EMPTY_IMPORT_MAP) {
    return "";
  }

  const serializedMap = JSON.stringify(parsedImportMap, null, 2);
  return `<script type="importmap" data-triticale-importmap>${serializedMap}</script>`;
}

export async function unmount(rootEl) {
  if (!(rootEl instanceof HTMLElement)) {
    throw new Error("unmount() requires a root HTMLElement");
  }

  try {
    rootEl.dispatchEvent(
      new Event("stop-synth", { bubbles: true, composed: true })
    );
  } catch (error) {
    console.error("Failed to dispatch stop-synth", error);
  }

  const ctx = rootEl.audioCtx;
  if (ctx && typeof ctx.close === "function" && ctx.state !== "closed") {
    try {
      await ctx.close();
    } catch (error) {
      console.warn("Failed to close triticale audio context", error);
    }
  }

  rootEl.remove();
}


export async function mount({ container, root } = {}) {
  if (!container) {
    throw new Error("mount() requires an { element } to attach to");
  }

  ensureApp();

  const fragment = getTemplateFragment(root);
  const rootEl = fragment.querySelector(root);

  if (!rootEl) {
    throw new Error(`Root ${root} should be present in the DOM`);
  }

  const style = document.createElement('style');
  style.textContent = styles;
  rootEl.appendChild(style);

  rewriteAssetReferences(fragment);

  container.style.backgroundColor = getComputedStyle(rootEl).backgroundColor;
  container.replaceChildren(fragment);

  return {
    container,
    rootEl,
  };
}

function rewriteAssetReferences(root) {
  if (!root) {
    return;
  }

  const mappings = [
    { selector: "img[src]", attribute: "src" },
  ];

  mappings.forEach(({ selector, attribute }) => {
    const elements = root.querySelectorAll(selector);
    elements.forEach((element) => {
      const current = element.getAttribute(attribute);
      if (!current) {
        return;
      }

      if (ABSOLUTE_URL_PATTERN.test(current)) {
        return;
      }

      const nextValue = makeAbsoluteUrl(current);
      if (nextValue !== current) {
        element.setAttribute(attribute, nextValue);
      }
    });
  });
}
