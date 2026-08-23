/**
 * Joins class names, dropping falsy values.
 *
 * Deliberately not `tailwind-merge`. This is a closed design system with three
 * spacing values and one radius, and tailwind-merge's conflict resolution does
 * not reliably understand custom scale names -- it cannot tell that
 * `text-caption` is a size and `text-ink-2` is a colour, so it would sometimes
 * drop the wrong one. Configuring it to know is more moving parts than the
 * problem deserves here.
 *
 * The consequence, and it is a real constraint: a `className` passed to these
 * components is ADDITIVE, not an override. Two competing utilities resolve by
 * stylesheet order, which is not the order you wrote them in. If a component
 * needs a different look, add a variant rather than fighting it from outside.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
