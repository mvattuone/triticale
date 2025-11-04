import { PUBLIC_PATH_KEY } from "./setPublicPath.js";

export function makeAbsoluteUrl(path) {
  if (!path) {
    return path;
  }

  // Return early when path is already absolute (new URL succeeds without base).
  try {
    return new URL(path).href;
  } catch (error) {
    // Ignore and fall through to relative resolution.
  }

  const base =
    globalThis[PUBLIC_PATH_KEY] ||
    (typeof document !== "undefined" && document.baseURI) ||
    (typeof window !== "undefined" && window.location?.href) ||
    null;

  if (!base) {
    return path;
  }

  try {
    return new URL(path, base).href;
  } catch (error) {
    return path;
  }
}
