import { Sparkline } from "@/components/charts/sparkline";
import { Delta } from "@/components/ui/status";

/**
 * Label, value, delta, trend — the four-part stat tile contract.
 *
 * Two details that are easy to get wrong and both visible:
 *
 * - **The value uses proportional figures, not tabular.** `tabular-nums` gives
 *   every digit the width of a zero, which is exactly right in a column and
 *   looks loose and gappy at tile size. §8 reserves tabular for table columns
 *   and axis ticks; this is neither.
 * - **`goodDirection` is required-by-habit rather than defaulted silently.**
 *   Rent collected rising is healthy; average days-to-resolve rising is not.
 *   The `Delta` component owns that inversion so no tile has to remember it.
 */
export function StatTile({
  label,
  value,
  delta,
  goodDirection = "up",
  deltaLabel = "vs last month",
  trend,
  trendLabel,
}: {
  label: string;
  value: string;
  delta?: number;
  goodDirection?: "up" | "down";
  deltaLabel?: string;
  trend?: number[];
  trendLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-tight border-t border-rule pt-base">
      <p className="eyebrow">{label}</p>

      <p className="text-title text-ink">{value}</p>

      <div className="flex items-end justify-between gap-tight">
        <div className="flex flex-wrap items-baseline gap-x-tight gap-y-1">
          {delta !== undefined && (
            <>
              <Delta ratio={delta} goodDirection={goodDirection} />
              {/* A delta with no named period is unreadable -- "+4.1%" against
                  what? */}
              <span className="text-caption text-ink-muted">{deltaLabel}</span>
            </>
          )}
        </div>

        {trend && trendLabel && <Sparkline values={trend} label={trendLabel} />}
      </div>
    </div>
  );
}
