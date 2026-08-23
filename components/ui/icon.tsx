import { cn } from "@/lib/cn";

/**
 * Hand-drawn 16px icons on a 1.5px stroke, to sit at the same optical weight
 * as the hairline rules. No icon library: this set is small enough that a
 * dependency would cost more than it saves, and matching the stroke to the
 * rules is the whole reason they look like they belong.
 *
 * Everything is `currentColor`, so an icon inherits whatever ink or status
 * colour its container already carries.
 */
const PATHS = {
  check: <path d="M3 8.5 6 11.5 13 4.5" />,
  clock: (
    <>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 4.75V8l2.5 1.75" />
    </>
  ),
  alertTriangle: (
    <>
      <path d="M8 2.25 14.75 13.75H1.25Z" />
      <path d="M8 6.5v3" />
      <path d="M8 11.75h.01" />
    </>
  ),
  alertCircle: (
    <>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 5v3.5" />
      <path d="M8 11.25h.01" />
    </>
  ),
  dot: <circle cx="8" cy="8" r="3.25" fill="currentColor" stroke="none" />,
  arrowUp: (
    <>
      <path d="M8 13V3.5" />
      <path d="M4.25 7.25 8 3.5l3.75 3.75" />
    </>
  ),
  arrowDown: (
    <>
      <path d="M8 3v9.5" />
      <path d="M4.25 8.75 8 12.5l3.75-3.75" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M3 8h10" />
      <path d="M9.25 4.25 13 8l-3.75 3.75" />
    </>
  ),
  minus: <path d="M4 8h8" />,
  close: (
    <>
      <path d="m4 4 8 8" />
      <path d="m12 4-8 8" />
    </>
  ),
  chevronDown: <path d="m4 6.25 4 4 4-4" />,
  chevronRight: <path d="m6.25 4 4 4-4 4" />,
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3.5 3.5" />
    </>
  ),
  inbox: (
    <>
      <path d="M2 9h3.5l1 2h3l1-2H14" />
      <path d="M2 9 4.25 3.5h7.5L14 9v4.5H2Z" />
    </>
  ),
  plus: (
    <>
      <path d="M8 3.5v9" />
      <path d="M3.5 8h9" />
    </>
  ),
  filter: (
    <>
      <path d="M2.5 4.5h11" />
      <path d="M4.75 8h6.5" />
      <path d="M6.75 11.5h2.5" />
    </>
  ),
  building: (
    <>
      <path d="M3.5 13.5V3.25h9V13.5" />
      <path d="M1.5 13.5h13" />
      <path d="M6 6h1.5M6 9h1.5M8.5 6H10M8.5 9H10" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className,
  size = 16,
}: {
  name: IconName;
  className?: string;
  /** Only change this for a genuinely different optical context. */
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
