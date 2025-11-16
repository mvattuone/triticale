import { makeAbsoluteUrl } from 'helpers/makeAbsoluteUrl.js';

export const loadWorkletModule = (() => {
  const cache = new WeakMap(); 
  return async (context, relativePath) => {
    if (!context?.audioWorklet) return;

    const url = makeAbsoluteUrl(relativePath);
    let loaded = cache.get(context);
    if (!loaded) {
      loaded = new Set();
      cache.set(context, loaded);
    }
    if (loaded.has(url)) return;

    await context.audioWorklet.addModule(url);
    loaded.add(url);
  };
})();
