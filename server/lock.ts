type TKey = string | number;

export default class Lock {
  private static tails = new Map<TKey, Promise<void>>();
  private readonly key: TKey;
  private _release?: () => void;

  constructor(key: TKey) {
    this.key = key;
  }

  async lock(): Promise<void> {
    const prev = Lock.tails.get(this.key) ?? Promise.resolve();
    let release!: () => void;
    Lock.tails.set(this.key, new Promise((r) => (release = r)));
    await prev;
    this._release = release;
  }

  release(): void {
    if (!this._release) throw new Error("Lock is not held");
    this._release();
    this._release = undefined;
  }

  static async with<T>(key: TKey, f: () => Promise<T>): Promise<T> {
    const lock = new Lock(key);
    await lock.lock();
    try {
      return await f();
    } finally {
      lock.release();
    }
  }
}
