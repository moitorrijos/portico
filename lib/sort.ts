/**
 * Natural ("human") comparison for labels that mix letters and numbers.
 *
 * Unit labels are exactly this shape -- 3A, 7A, 9D, 14B, 22C -- and a plain
 * string sort puts "14B" before "3A" because "1" < "3". Nobody scanning a
 * rent roll reads that as sorted, and it is the kind of wrongness that looks
 * like a bug in the data rather than in the comparator.
 *
 * Intl.Collator with numeric:true does this properly, including for accented
 * resident names, and it is far faster than a hand-rolled chunk-splitter
 * because the comparison happens in native code.
 */
const collator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

export function compareNatural(a: string, b: string): number {
  return collator.compare(a, b);
}

/** Ascending/descending wrapper, so call sites do not re-implement the flip. */
export function byNatural<T>(
  select: (item: T) => string,
  direction: "asc" | "desc" = "asc",
) {
  const sign = direction === "asc" ? 1 : -1;
  return (a: T, b: T) => sign * compareNatural(select(a), select(b));
}
