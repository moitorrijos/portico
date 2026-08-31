import { cn } from "@/lib/cn";

/**
 * A single proportion, shown as one bar.
 *
 * The form for "how much of the whole" when there is exactly one number worth
 * reading -- rent collected against rent billed. A donut would say the same
 * thing in more ink and force the reader to compare angles.
 *
 * Per the meter contract the fill carries severity and the track is a lighter
 * step of the same ramp, so the state reads across the whole bar rather than
 * only where it happens to stop. Severity here is genuinely a status: a
 * collection rate below 90% is a problem a manager acts on, which is exactly
 * what the reserved status palette is for.
 */
export function Meter({
  ratio,
  label,
  valueLabel,
  className,
}: {
  /** 0–1. Clamped, because a payment posted twice should not overflow the bar. */
  ratio: number;
  label: string;
  valueLabel: string;
  className?: string;
}) {
  const clamped = Math.min(1, Math.max(0, ratio));
  const percent = Math.round(clamped * 100);

  const tone =
    clamped >= 0.95 ? "good" : clamped >= 0.9 ? "warning" : "critical";

  const FILL = {
    good: "bg-good",
    warning: "bg-warning",
    critical: "bg-critical",
  } as const;

  return (
    <div className={cn("flex flex-col gap-tight", className)}>
      <div className="flex items-baseline justify-between gap-tight">
        <span className="eyebrow">{label}</span>
        <span className="text-body text-ink">{valueLabel}</span>
      </div>

      <div
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        // The track is one step of the same family, not a neutral grey.
        className="h-2 w-full overflow-hidden rounded-[var(--radius-base)] bg-surface"
      >
        <div
          className={cn("h-full rounded-[var(--radius-base)]", FILL[tone])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
