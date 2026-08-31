/**
 * Display helpers that are not about money.
 */

/**
 * `0` -> `"Studio"`, everything else -> the number.
 *
 * The seed deliberately includes studios — three of forty-two, at around 520
 * sq ft. Rendering that as a bare `0` in a "Beds" column is ambiguous in
 * exactly the wrong way: it reads as missing data rather than as a unit type,
 * and a rent roll with holes in it is the fastest way to make seeded data look
 * broken.
 *
 * The word stays right-aligned with the figures beside it. Real rent rolls do
 * the same, and one word among numbers is far easier to scan than a zero that
 * has to be interpreted.
 */
export function formatBedrooms(bedrooms: number): string {
  return bedrooms === 0 ? "Studio" : String(bedrooms);
}

/** `"IN_PROGRESS"` -> `"In progress"`. Enum values are not display strings. */
export function formatEnumLabel(value: string): string {
  const lower = value.replace(/_/g, " ").toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
