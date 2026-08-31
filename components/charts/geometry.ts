/**
 * Chart geometry.
 *
 * Every chart here is hand-rolled SVG with a fixed `viewBox` scaled to 100%
 * width, so nothing has to measure the DOM to know how big it is. That is what
 * lets the marks render on the server: a charting library would need a client
 * component and a layout pass before it could draw anything, which is a
 * spinner on the most important screen in the app.
 *
 * The trade is that stroke widths scale with the box. Every chart below is
 * given a viewBox close to its real rendered pixel size and
 * `vectorEffect="non-scaling-stroke"` on the marks, so a 2px line stays 2px
 * instead of becoming 2px × whatever the scale factor is.
 */

export type Point = { x: number; y: number };

/** Inner plot area after axis gutters. */
export type Plot = {
  width: number;
  height: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function plotArea(
  width: number,
  height: number,
  padding: { left: number; top: number; right: number; bottom: number },
): Plot {
  return {
    width,
    height,
    left: padding.left,
    top: padding.top,
    right: width - padding.right,
    bottom: height - padding.bottom,
  };
}

/**
 * Nice round axis maximum, so ticks land on 0 / 20,000 / 40,000 rather than on
 * 0 / 18,437 / 36,874. Reference: "Y-axis ticks: round to clean numbers."
 *
 * Rounded on the *tick interval* rather than on the maximum itself. Rounding
 * the max snaps to the next power-friendly number and can nearly double it --
 * a series peaking at 55k became a 100k axis, so the data used the bottom half
 * of the plot and the whole chart looked like it was flatlining. Choosing a
 * clean interval instead gives 0/15k/30k/45k/60k: still round, and the marks
 * fill the box.
 */
export function niceMax(value: number, tickCount = 4): number {
  if (value <= 0) return 1;

  const rawStep = value / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;

  // Intervals a reader can do arithmetic on in their head.
  const step =
    [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10].find((candidate) => normalised <= candidate) ?? 10;

  return step * magnitude * tickCount;
}

/** Evenly spaced tick values from 0 to max inclusive. */
export function ticksTo(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i);
}

/**
 * Maps values onto the plot. Y is inverted because SVG's origin is top-left
 * and a chart's is bottom-left -- the single most common off-by-everything
 * mistake in hand-rolled charts.
 */
export function scalePoints(
  values: number[],
  max: number,
  plot: Plot,
  /** Baseline value. Zero for axed charts; the series minimum for sparklines. */
  min = 0,
): Point[] {
  const span = plot.right - plot.left;
  // A single point sits in the middle rather than at x=0, where it would look
  // like a truncated series.
  const step = values.length > 1 ? span / (values.length - 1) : 0;

  return values.map((value, index) => ({
    x: values.length > 1 ? plot.left + step * index : plot.left + span / 2,
    y:
      plot.bottom -
      (max === min
        ? 0
        : ((value - min) / (max - min)) * (plot.bottom - plot.top)),
  }));
}

/** `M x y L x y ...` -- straight segments, no curve smoothing.
 *
 *  Deliberately not a spline. Smoothing invents values between the months that
 *  were never measured, and on a rent-collected series it can dip below zero
 *  between two positive points. A monthly total is a step, not a curve. */
export function linePath(points: Point[]): string {
  return points
    .map((point, i) => `${i === 0 ? "M" : "L"}${round(point.x)} ${round(point.y)}`)
    .join(" ");
}

/** The same path closed down to the baseline, for the 10% area wash. */
export function areaPath(points: Point[], baseline: number): string {
  if (points.length === 0) return "";
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${linePath(points)} L${round(last.x)} ${round(baseline)} L${round(first.x)} ${round(baseline)} Z`;
}

/**
 * A bar with its data-end rounded and its baseline square.
 *
 * Reference: "4px rounded data-end, square at the baseline". A plain `rx` on a
 * `<rect>` rounds all four corners, which detaches the bar from its axis and is
 * the giveaway that a chart was drawn with defaults.
 */
export function horizontalBarPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 4,
): string {
  // Below about 2r the arc has no room and the curve inverts into a pinch.
  const r = Math.min(radius, width / 2, height / 2);
  if (width <= 0) return "";
  return [
    `M${round(x)} ${round(y)}`,
    `H${round(x + width - r)}`,
    `A${round(r)} ${round(r)} 0 0 1 ${round(x + width)} ${round(y + r)}`,
    `V${round(y + height - r)}`,
    `A${round(r)} ${round(r)} 0 0 1 ${round(x + width - r)} ${round(y + height)}`,
    `H${round(x)}`,
    "Z",
  ].join(" ");
}

/** Two decimals is well under a device pixel and keeps the markup readable. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
