/**
 * Money is stored as integer cents everywhere -- never a float. Rent ledgers
 * that drift by a cent because of binary fractions are the classic version of
 * this bug, and a ledger is the design problem this project is showing off.
 */

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD_WHOLE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** `124850` -> `"$1,248.50"`. For ledger rows and any exact amount. */
export function formatMoney(cents: number): string {
  return USD.format(cents / 100);
}

/**
 * `124850` -> `"$1,249"`. For stat tiles and summaries, where two decimals of
 * precision are noise. Never use on a row a resident might reconcile against
 * their bank statement.
 */
export function formatMoneyWhole(cents: number): string {
  return USD_WHOLE.format(cents / 100);
}

/**
 * `124850` -> `"$1.2k"`. Axis ticks only -- these sit at 12px where a full
 * figure would collide with its neighbour.
 */
export function formatMoneyAxis(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1_000_000) {
    return `$${trimZero(dollars / 1_000_000)}M`;
  }
  if (Math.abs(dollars) >= 1_000) {
    return `$${trimZero(dollars / 1_000)}k`;
  }
  return `$${Math.round(dollars)}`;
}

function trimZero(n: number): string {
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** `0.9423` -> `"94.2%"`. One decimal: occupancy moves in fractions of a unit. */
export function formatPercent(ratio: number, decimals = 1): string {
  return `${(ratio * 100).toFixed(decimals)}%`;
}

/**
 * Signed delta for stat tiles: `+4.1%` / `-1.8%` / `0.0%`.
 * The sign is explicit because "4.1%" next to a number is ambiguous about
 * whether it is a value or a change.
 */
export function formatDelta(ratio: number, decimals = 1): string {
  const pct = ratio * 100;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${Math.abs(pct).toFixed(decimals)}%`;
}

/** Which way a delta points, for choosing an icon and a status colour. */
export function deltaDirection(ratio: number): "up" | "down" | "flat" {
  if (ratio > 0.0001) return "up";
  if (ratio < -0.0001) return "down";
  return "flat";
}
