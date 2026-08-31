import { CrosshairLayer } from "@/components/charts/crosshair-layer";
import {
  areaPath,
  linePath,
  niceMax,
  plotArea,
  scalePoints,
  ticksTo,
} from "@/components/charts/geometry";

/**
 * A single series over time.
 *
 * One y-axis, always. Rent collected and occupancy are two different measures
 * on two different scales, and putting them on one chart with two axes lets the
 * author choose where the lines cross -- which is why they are two charts here.
 *
 * Straight segments, not a spline: see the note on `linePath`. Monthly totals
 * are steps, and smoothing draws values that were never measured.
 *
 * Server component. The pointer maths lives in `CrosshairLayer`, so the marks,
 * the axes and every formatted label are rendered here and shipped as HTML.
 */
export function LineChart({
  values,
  labels,
  formatValue,
  formatTick,
  height = 200,
}: {
  values: number[];
  /** One per value, e.g. "Aug 2026". */
  labels: string[];
  /** For the tooltip readout. */
  formatValue: (value: number) => string;
  /** For the y-axis. Short -- these sit at 12px. */
  formatTick: (value: number) => string;
  height?: number;
}) {
  const width = 720;
  const plot = plotArea(width, height, {
    left: 48,
    top: 12,
    right: 8,
    bottom: 24,
  });

  const max = niceMax(Math.max(...values, 1));
  const points = scalePoints(values, max, plot);
  const ticks = ticksTo(max);
  const last = points[points.length - 1]!;

  // Label the first and last month only. A tick under every point collides at
  // twelve points and reads as a solid grey bar.
  const edgeLabels = [0, labels.length - 1];

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        // Described by the table view and the crosshair overlay's own label;
        // marking the static layer presentational avoids announcing the same
        // chart twice.
        aria-hidden="true"
        className="w-full"
      >
        {ticks.map((tick) => {
          const y = plot.bottom - (tick / max) * (plot.bottom - plot.top);
          return (
            <g key={tick}>
              {/* Hairline, solid, recessive. Never dashed. */}
              <line
                x1={plot.left}
                x2={plot.right}
                y1={y}
                y2={y}
                stroke="var(--rule)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={plot.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="central"
                className="fill-ink-muted figures-tabular"
                style={{ fontSize: 12 }}
              >
                {formatTick(tick)}
              </text>
            </g>
          );
        })}

        {/* ~10% wash, never a saturated block. */}
        <path d={areaPath(points, plot.bottom)} className="fill-seq-3/10" />

        <path
          d={linePath(points)}
          fill="none"
          stroke="var(--seq-3)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        <circle
          cx={last.x}
          cy={last.y}
          r={4}
          fill="var(--seq-3)"
          stroke="var(--ground)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />

        {edgeLabels.map((index) => (
          <text
            key={index}
            x={points[index]!.x}
            y={height - 6}
            textAnchor={index === 0 ? "start" : "end"}
            className="fill-ink-muted"
            style={{ fontSize: 12 }}
          >
            {labels[index]}
          </text>
        ))}
      </svg>

      <CrosshairLayer
        points={points}
        labels={labels}
        values={values.map(formatValue)}
        viewWidth={width}
        viewHeight={height}
        top={plot.top}
        bottom={plot.bottom}
      />
    </div>
  );
}
