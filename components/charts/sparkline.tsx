import { linePath, plotArea, scalePoints } from "@/components/charts/geometry";

/**
 * The trend line in a stat tile. No axes, no labels, no tooltip.
 *
 * This is the one chart form that legitimately skips the hover layer: it sits
 * inside a stat tile whose value and delta already state the current figure and
 * its direction, and the full series is in the twelve-month chart below with a
 * table view of its own. A sparkline is shape, not lookup.
 *
 * Per the stat-tile contract the series is drawn in the de-emphasis hue with
 * the current period marked in the accent, so the eye lands on "now" without
 * needing a label.
 */
export function Sparkline({
  values,
  label,
  width = 120,
  height = 28,
}: {
  values: number[];
  /** Describes the trend for anyone who cannot see it. */
  label: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    // One point is not a trend. Render nothing rather than a dot that implies
    // a series, and let the tile's value carry the whole story.
    return null;
  }

  // Padded by the marker radius plus its surface ring, or the end dot clips.
  const plot = plotArea(width, height, { left: 1, top: 5, right: 5, bottom: 5 });

  /*
   * Scaled to the series' own range, NOT to a zero baseline.
   *
   * A sparkline is shape: the tile's value directly above it already states
   * the level. Anchoring at zero squeezed a 44k-55k series into the top fifth
   * of a 28px box, where it rendered as a near-flat squiggle that read as a
   * broken chart rather than as a stable one.
   *
   * The honest magnitude has not gone anywhere -- the twelve-month chart below
   * plots the same series against a real zero-based axis with a table view.
   * This is the summary; that is the record.
   */
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // A flat series would divide by zero; give it a band so it draws a level line.
  const pad = rawMax === rawMin ? Math.abs(rawMax) * 0.1 || 1 : (rawMax - rawMin) * 0.15;
  const points = scalePoints(values, rawMax + pad, plot, rawMin - pad);
  const last = points[points.length - 1]!;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className="overflow-visible"
    >
      <path
        d={linePath(points)}
        fill="none"
        stroke="var(--seq-1)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* r=4 gives the 8px minimum marker; the 2px ring in the surface colour
          keeps it legible where it sits on the line. */}
      <circle
        cx={last.x}
        cy={last.y}
        r={4}
        fill="var(--accent)"
        stroke="var(--ground)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
