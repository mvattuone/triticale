export class LRUCache {
  constructor(size) {
    this.size = size;
    this.cache = new Map()
  }

  write(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.cache.set(key, value);
    } else if (this.cache.size >= this.size) {
        const lru = this.cache.keys().next().value;
        this.cache.delete(lru)
        this.cache.set(key, value);
    } else {
      this.cache.set(key, value);
    }
  }

  read(key) {
    let value;
    if (this.cache.has(key)) {
      value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
  }

  clear() {
    this.cache.clear();
  }

  dump() {
    return [...this.cache.entries()].map(([key, value]) => `${key}: ${value}`).join('\n');
  }
}
