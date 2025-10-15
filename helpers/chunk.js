export function* chunk(arr, chunkSize) {
  if (chunkSize <= 0) return;

  for (let i = 0; i < arr.length; i += chunkSize) {
    yield arr.slice(i, i + chunkSize); 
  }
}
