/**
 * A small seeded PRNG, so the demo is reproducible.
 *
 * This is not fussiness. Spec §9 says *"seed quality is the whole illusion"*,
 * and the nightly reset truncates and re-seeds — so with `Math.random()` the
 * demo would look subtly different every morning. A screenshot in the case
 * study would stop matching the live site, and "the unit with the interesting
 * payment history" would be a different unit each day.
 *
 * mulberry32: 32-bit state, good enough distribution for demo data, and short
 * enough to read. Nothing here is cryptographic and nothing should be.
 */
export function createRng(seed: number) {
  let state = seed >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    /** Integer in [min, max]. */
    int(min: number, max: number): number {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    /** True with probability `p`. */
    chance(p: number): boolean {
      return next() < p;
    },
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(next() * items.length)]!;
    },
    /** Picks `count` distinct items, order preserved. */
    sample<T>(items: readonly T[], count: number): T[] {
      const pool = [...items];
      const out: T[] = [];
      for (let i = 0; i < count && pool.length > 0; i++) {
        out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]!);
      }
      return out;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
}

/**
 * The seed. Change it and every id, name pairing and payment history changes.
 * Pinned so the case-study screenshots keep matching the live demo.
 */
export const DEMO_SEED = 20260826;
