import { horizontalBarPath } from "@/components/charts/geometry";

/**
 * Horizontal bars for magnitude across a handful of named things.
 *
 * Horizontal rather than vertical because the categories are community names,
 * and vertical columns would either truncate them or rotate them 45°. A
 * rotated axis label is a layout failure the reader has to compensate for.
 *
 * ## Why every bar is the same colour
 *
 * It would be easy to run the sequential ramp across the three bars, darkest
 * for the highest occupancy. That would be colour encoding *rank*, which
 * breaks the moment a filter reorders them -- the survivors get repainted and
 * a colour that meant "Arbor Row" now means "The Mercer". Length already
 * carries the magnitude. One hue, and the bar's own length is the data.
 */
export function HBarChart({
  data,
  formatValue,
  barHeight = 20,
  gap = 12,
  labelWidth = 128,
}: {
  data: { label: string; value: number; max: number }[];
  /** Receives both numbers: a bare "12" beside a part-filled bar is ambiguous
   *  about whether it is the bar's value or the track's total. */
  formatValue: (value: number, max: number) => string;
  barHeight?: number;
  gap?: number;
  labelWidth?: number;
}) {
  const width = 520;
  const height = data.length * barHeight + Math.max(0, data.length - 1) * gap;
  // Room at the right for the value label so it never collides with the bar tip.
  const trackRight = width - 84;
  const trackWidth = trackRight - labelWidth;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="Occupancy by community"
      preserveAspectRatio="xMinYMin meet"
    >
      {data.map((item, index) => {
        const y = index * (barHeight + gap);
        const ratio = item.max === 0 ? 0 : item.value / item.max;
        const filled = trackWidth * ratio;

        return (
          <g key={item.label}>
            {/* Category label in ink, never in the series colour. */}
            <text
              x={0}
              y={y + barHeight / 2}
              dominantBaseline="central"
              className="fill-ink text-caption"
              style={{ fontSize: 12 }}
            >
              {item.label}
            </text>

            {/* The track is a lighter step of the same ramp, so the unfilled
                remainder reads as "the rest of this bar" rather than as a
                separate grey object. */}
            <rect
              x={labelWidth}
              y={y}
              width={trackWidth}
              height={barHeight}
              rx={4}
              className="fill-surface"
            />

            <path
              d={horizontalBarPath(labelWidth, y, filled, barHeight)}
              className="fill-seq-3"
            />

            {/* Value at the tip -- the one direct label this chart gets. */}
            <text
              x={trackRight + 8}
              y={y + barHeight / 2}
              dominantBaseline="central"
              className="fill-ink-2 figures-tabular"
              style={{ fontSize: 12 }}
            >
              {formatValue(item.value, item.max)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
