import { makeAbsoluteUrl } from 'helpers/makeAbsoluteUrl.js';

const BASE_FROM_IMPORT = (() => {
  try {
    return new URL('./', import.meta.url).href;
  } catch (error) {
    return null;
  }
})();

function buildCandidateUrls(relativePath) {
  const urls = [];
  const seen = new Set();
  const add = (value) => {
    if (!value) return;
    try {
      const url = new URL(value).href;
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    } catch (error) {
      // ignore invalid URL
    }
  };

  add(makeAbsoluteUrl(relativePath));

  if (BASE_FROM_IMPORT) {
    add(new URL(relativePath, BASE_FROM_IMPORT).href);
  }

  if (typeof window !== 'undefined' && window.location) {
    add(new URL(relativePath, window.location.origin + '/').href);
  }

  return urls;
}

export const loadWorkletModule = (() => {
  const cache = new WeakMap(); 
  return async (context, relativePath) => {
    if (!context?.audioWorklet) return;

    const candidates = buildCandidateUrls(relativePath);
    let loaded = cache.get(context);
    if (!loaded) {
      loaded = new Set();
      cache.set(context, loaded);
    }
    for (const url of candidates) {
      if (loaded.has(url)) {
        return;
      }
      try {
        await context.audioWorklet.addModule(url);
        loaded.add(url);
        return;
      } catch (error) {
        console.warn(`[triticale] Failed to load worklet module from ${url}:`, error?.message || error);
      }
    }

    throw new Error(`Failed to load worklet module "${relativePath}" after trying: ${candidates.join(', ')}`);
  };
})();
