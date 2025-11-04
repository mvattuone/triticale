export const PUBLIC_PATH_KEY = "__triticalePublicPath__";

export function setPublicPath(url) {
  globalThis[PUBLIC_PATH_KEY] = url;
}
