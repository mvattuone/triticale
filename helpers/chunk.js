export const chunk = (arr, chunkSize) => {
  if (chunkSize <= 0) return [];

  const chunks = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }

  return chunks;
};
