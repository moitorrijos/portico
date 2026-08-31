"use client";

import { useState } from "react";

import type { Point } from "@/components/charts/geometry";

/**
 * The only part of a line chart that has to run in the browser.
 *
 * It sits over the server-rendered SVG as a transparent overlay sharing the
 * same `viewBox`, so it can position a hairline in the same coordinate space
 * without the chart itself becoming a client component. The marks, axes and
 * labels are all server output; this ships the pointer maths and nothing else.
 *
 * Two rules from the interaction spec are doing real work here:
 *
 * - **The crosshair finds the X.** The reader aims at a month, not at a 2px
 *   line, so the nearest index is chosen by horizontal distance alone and the
 *   readout follows. Requiring the pointer to land on the line would make the
 *   values in a flat series nearly unreachable.
 * - **Keyboard gets the same detail as hover.** The overlay is focusable and
 *   arrow-navigable. A tooltip that only exists on hover puts every value
 *   behind a mouse, which is why the table view is not the whole answer.
 */
export function CrosshairLayer({
  points,
  labels,
  values,
  viewWidth,
  viewHeight,
  top,
  bottom,
}: {
  points: Point[];
  /** X-axis label per point, e.g. "Aug 2026". */
  labels: string[];
  /** Pre-formatted value per point -- formatting stays on the server. */
  values: string[];
  viewWidth: number;
  viewHeight: number;
  top: number;
  bottom: number;
}) {
  const [active, setActive] = useState<number | null>(null);

  /** Nearest point by x, in viewBox units. */
  function indexFromEvent(event: React.PointerEvent<SVGSVGElement>): number {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return 0;
    // Pointer -> viewBox. The SVG scales to its container, so the ratio is the
    // only reliable conversion; reading clientX directly would be off by the
    // scale factor at every width but one.
    const x = ((event.clientX - rect.left) / rect.width) * viewWidth;

    let nearest = 0;
    let best = Infinity;
    points.forEach((point, index) => {
      const distance = Math.abs(point.x - x);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    return nearest;
  }

  function onKeyDown(event: React.KeyboardEvent<SVGSVGElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    setActive((current) => {
      const next = (current ?? points.length - 1) + step;
      return Math.min(points.length - 1, Math.max(0, next));
    });
  }

  const point = active === null ? null : points[active];
  // Flip the readout to the left of the hairline once it would overflow the
  // right edge, rather than letting it clip.
  const flip = point !== null && point.x > viewWidth * 0.66;

  return (
    <>
      <svg
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        width="100%"
        height={viewHeight}
        preserveAspectRatio="none"
        tabIndex={0}
        role="application"
        aria-label="Rent collected by month. Use the left and right arrow keys to read each month."
        className="absolute inset-0 h-full w-full cursor-crosshair focus-visible:outline-2 focus-visible:outline-accent"
        onPointerMove={(event) => setActive(indexFromEvent(event))}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        {point && (
          <g>
            <line
              x1={point.x}
              x2={point.x}
              y1={top}
              y2={bottom}
              stroke="var(--ink-muted)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            {/* The 2px surface ring keeps the marker readable where it lands
                on the line it is marking. */}
            <circle
              cx={point.x}
              cy={point.y}
              r={4}
              fill="var(--accent)"
              stroke="var(--ground)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
      </svg>

      {/* An HTML readout rather than SVG <text>: it needs to wrap, use the type
          scale, and never inherit the chart's coordinate scaling. */}
      {active !== null && point && (
        <div
          aria-live="polite"
          className="pointer-events-none absolute z-10 -translate-y-1/2 rounded-[var(--radius-base)] border border-rule bg-ground px-tight py-1 whitespace-nowrap"
          style={{
            left: `${(point.x / viewWidth) * 100}%`,
            top: "50%",
            transform: `translate(${flip ? "calc(-100% - 12px)" : "12px"}, -50%)`,
          }}
        >
          {/* Values lead, labels follow: the reader already knows the month
              they are pointing at and wants the number. */}
          <p className="figures-tabular text-body text-ink">{values[active]}</p>
          <p className="text-caption text-ink-muted">{labels[active]}</p>
        </div>
      )}
    </>
  );
}
