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
const HOST_CACHE_KEY = "triticale:state";

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

export async function unmount(rootEl, hostContext = null) {
  if (!(rootEl instanceof HTMLElement)) {
    throw new Error("unmount() requires a root HTMLElement");
  }

  persistSynthState(rootEl, hostContext);

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


export async function mount({ container, root, host } = {}) {
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

  restoreSynthState(rootEl, host);

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

function persistSynthState(rootEl, hostContext) {
  const cache = resolveHostCache(hostContext);
  if (!cache) {
    return;
  }

  const snapshot = createSynthSnapshot(rootEl);
  if (!snapshot) {
    cache.delete(HOST_CACHE_KEY);
    return;
  }

  cache.write(HOST_CACHE_KEY, snapshot);
}

function restoreSynthState(rootEl, hostContext) {
  const cache = resolveHostCache(hostContext);
  if (!cache) {
    return;
  }

  const snapshot = cache.read(HOST_CACHE_KEY);
  if (!snapshot) {
    return;
  }

  if (snapshot.config) {
    applyConfigSnapshot(rootEl, snapshot.config);
  }

  if (snapshot.audioSelection) {
    rootEl.applyAudioSelectionBuffer(snapshot.audioSelection);
  }

  if (snapshot.imageBuffer) {
    rootEl.applyImageBuffer(snapshot.imageBuffer);
  }

  const synthWaveform = rootEl.querySelector("synth-waveform");
  if (synthWaveform && snapshot.waveform?.buffer && typeof synthWaveform.loadAudio === "function") {
    synthWaveform.loadAudio(snapshot.waveform.buffer);
  }

  const synthDisplay = rootEl.querySelector("synth-display");
  if (synthDisplay && snapshot.display) {
    hydrateDisplay(synthDisplay, snapshot.display);
  }
}

function createSynthSnapshot(rootEl) {
  if (!(rootEl instanceof HTMLElement)) {
    return null;
  }

  const synthWaveform = rootEl.querySelector("synth-waveform");
  const synthDisplay = rootEl.querySelector("synth-display");

  const snapshot = {};

  if (rootEl.config) {
    snapshot.config = cloneConfig(rootEl.config);
  }

  if (rootEl.audioSelection) {
    snapshot.audioSelection = rootEl.audioSelection;
  }

  if (rootEl.imageBuffer) {
    snapshot.imageBuffer = rootEl.imageBuffer;
  }

  if (synthWaveform?.buffer) {
    snapshot.waveform = {
      buffer: synthWaveform.buffer,
    };
  }

  const displaySnapshot = createDisplaySnapshot(synthDisplay);
  if (displaySnapshot) {
    snapshot.display = displaySnapshot;
  }

  if (Object.keys(snapshot).length === 0) {
    return null;
  }

  return snapshot;
}

function createDisplaySnapshot(display) {
  if (!display?.image) {
    return null;
  }

  const snapshot = {
    width: display.image?.width ?? null,
    height: display.image?.height ?? null,
    dataUrl: null,
    src: null,
  };

  const canvas = display.canvas;
  if (canvas && typeof canvas.toDataURL === "function") {
    try {
      snapshot.dataUrl = canvas.toDataURL("image/png");
    } catch (error) {
      console.warn("Failed to serialize synth-display canvas", error);
      snapshot.src = display.image?.src ?? null;
    }
  } else {
    snapshot.src = display.image?.src ?? null;
  }

  if (!snapshot.dataUrl && !snapshot.src) {
    return null;
  }

  return snapshot;
}

function hydrateDisplay(display, snapshot) {
  const nextImage = new Image(snapshot.width || undefined, snapshot.height || undefined);
  nextImage.decoding = "async";
  nextImage.crossOrigin = "anonymous";

  const applyImage = () => {
    if (typeof display.drawImage === "function") {
      display.drawImage(nextImage);
    }
  };

  nextImage.onload = applyImage;
  nextImage.onerror = () => {
    if (snapshot.src && snapshot.src !== nextImage.src) {
      nextImage.src = snapshot.src;
      return;
    }
  };

  if (snapshot.dataUrl) {
    nextImage.src = snapshot.dataUrl;
  } else if (snapshot.src) {
    nextImage.src = snapshot.src;
  }
}

function applyConfigSnapshot(rootEl, snapshot) {
  if (!rootEl || typeof rootEl.updateConfig !== "function" || !snapshot) {
    return;
  }

  const entries = [];

  flattenConfig(snapshot, "", entries);

  entries.forEach(({ path, value }) => {
    try {
      rootEl.updateConfig(path, value);
    } catch (error) {
      console.warn(`Failed to restore config value for ${path}`, error);
    }
  });
}

function flattenConfig(node, prefix, accumulator) {
  if (node === null || typeof node !== "object") {
    if (prefix) {
      accumulator.push({ path: prefix, value: node });
    }
    return;
  }

  Object.entries(node).forEach(([key, value]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      flattenConfig(value, nextPrefix, accumulator);
    } else if (prefix || typeof value !== "object") {
      accumulator.push({ path: nextPrefix, value });
    }
  });
}

function cloneConfig(config) {
  if (!config) {
    return null;
  }

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(config);
    } catch {
      // fall through to JSON cloning
    }
  }

  try {
    return JSON.parse(JSON.stringify(config));
  } catch {
    return null;
  }
}

function resolveHostCache(hostContext) {
  if (!hostContext) {
    return null;
  }

  if (hostContext.cache) {
    return hostContext.cache;
  }

  return hostContext;
}
