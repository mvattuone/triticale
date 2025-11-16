export function random(x, y) {
  return Math.floor(x + (y - x + 1) * crypto.getRandomValues(new Uint32Array(1))[0] / 2**32); 
};
