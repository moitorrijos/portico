import { Icon, type IconName } from "@/components/ui/icon";
import { deltaDirection, formatDelta } from "@/lib/money";
import { cn } from "@/lib/cn";

/**
 * Status is never colour alone. The icon is not decoration: on the ivory
 * ground, `warning` and `serious` both sit below 3:1, so the icon and the word
 * are what actually carry the meaning for anyone who cannot separate the hues.
 *
 * The API makes that structural -- there is no way to render a bare coloured
 * dot, because `children` is required and the icon is chosen by tone rather
 * than passed in. Getting this wrong has to be deliberate.
 *
 * Note it is not a filled pill. A tinted capsule is the templated answer, and
 * §7 asks for hierarchy from size and spacing rather than weight and colour --
 * in a forty-row table, forty capsules read as noise where forty small marks
 * read as a column you can scan.
 */
export type Tone = "good" | "warning" | "serious" | "critical" | "neutral";

const TONE_ICON: Record<Tone, IconName> = {
  good: "check",
  warning: "clock",
  serious: "alertTriangle",
  critical: "alertCircle",
  neutral: "dot",
};

const TONE_COLOR: Record<Tone, string> = {
  good: "text-good",
  warning: "text-warning",
  serious: "text-serious",
  critical: "text-critical",
  neutral: "text-ink-muted",
};

export function Status({
  tone,
  children,
  className,
}: {
  tone: Tone;
  /** Required. A status with no label is a status nobody can read. */
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-body font-medium whitespace-nowrap",
        TONE_COLOR[tone],
        className,
      )}
    >
      <Icon name={TONE_ICON[tone]} size={14} />
      {children}
    </span>
  );
}

/**
 * Signed change for stat tiles, with an arrow so direction survives without
 * colour.
 *
 * `goodDirection` exists because up is not universally good: rent collected
 * rising is healthy, average days-to-resolve rising is not. Without it every
 * tile would need to remember to invert its own colours, which is exactly the
 * rule that gets forgotten on the one tile nobody re-checks.
 */
export function Delta({
  ratio,
  goodDirection = "up",
  className,
}: {
  ratio: number;
  goodDirection?: "up" | "down";
  className?: string;
}) {
  const direction = deltaDirection(ratio);

  const tone: Tone =
    direction === "flat"
      ? "neutral"
      : direction === goodDirection
        ? "good"
        : "serious";

  const icon: IconName =
    direction === "up" ? "arrowUp" : direction === "down" ? "arrowDown" : "minus";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-caption font-medium",
        TONE_COLOR[tone],
        className,
      )}
    >
      <Icon name={icon} size={12} />
      {/* Proportional figures: a delta sits beside its value, not in a column
          of other deltas, so §8 does not ask for tabular here. */}
      {formatDelta(ratio)}
    </span>
  );
}
