export class BoundedCache<T> {
  private readonly values = new Map<string, T>();

  constructor(private readonly maximumEntries: number) {
    if (!Number.isInteger(maximumEntries) || maximumEntries < 1) {
      throw new Error("maximumEntries must be a positive integer");
    }
  }

  get(key: string) {
    const value = this.values.get(key);
    if (value === undefined) return undefined;
    this.values.delete(key);
    this.values.set(key, value);
    return value;
  }

  set(key: string, value: T) {
    if (this.values.has(key)) this.values.delete(key);
    this.values.set(key, value);
    while (this.values.size > this.maximumEntries) {
      const oldestKey = this.values.keys().next().value;
      if (oldestKey === undefined) break;
      this.values.delete(oldestKey);
    }
  }

  clear() {
    this.values.clear();
  }

  get size() {
    return this.values.size;
  }
}
