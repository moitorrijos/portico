import "server-only";

import { requireManager } from "@/lib/dal";
import { db } from "@/lib/db";
import type {
  LatePaymentDTO,
  ManagerOverviewDTO,
  MonthPointDTO,
  RequestSummaryDTO,
} from "@/lib/dto";

/**
 * The manager overview's numbers.
 *
 * This is the screen a prospect judges the whole project on, so the figures
 * have to be real aggregates over the seeded data rather than anything
 * precomputed or hardcoded. Every number here is derived from the same rows the
 * units table and the ledger show, which is what makes the app feel like one
 * system instead of a set of screens.
 *
 * Guarded by role, not ownership: a manager legitimately sees everything. There
 * is no per-community scoping because spec §12 puts multi-tenancy out of scope
 * -- one management company, all three communities.
 */

/** How much history the sparklines and the twelve-month chart cover. */
const MONTHS = 12;

/**
 * First instant of the month `n` months before the current one.
 *
 * Built from UTC parts rather than by subtracting milliseconds: month lengths
 * differ, and `Date.now() - 30 * DAY` drifts by days over a year, which would
 * silently put a payment in the wrong bucket.
 */
function monthStart(monthsAgo: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
}

/** `2026-08` — a stable key for bucketing, independent of locale. */
function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getManagerOverview(): Promise<ManagerOverviewDTO> {
  await requireManager();

  const windowStart = monthStart(MONTHS - 1);
  const thisMonthStart = monthStart(0);
  const lastMonthStart = monthStart(1);

  const [unitCounts, communities, payments, openRequests, resolvedRequests] =
    await Promise.all([
      db.unit.groupBy({ by: ["status"], _count: { _all: true } }),

      db.community.findMany({
        select: {
          id: true,
          name: true,
          units: { select: { status: true } },
        },
        orderBy: { name: "asc" },
      }),

      // One pass over the window, bucketed in JavaScript. Twelve grouped
      // queries would each be cheap and the round trips would not be.
      db.payment.findMany({
        where: { dueDate: { gte: windowStart } },
        // `paidAt`, not `status`. Rent paid two weeks late is still rent
        // collected; counting only status PAID would understate every month by
        // its late payments and make the collection meter permanently red.
        select: { amountCents: true, dueDate: true, paidAt: true },
      }),

      db.request.findMany({
        where: { status: { not: "RESOLVED" } },
        select: { id: true, createdAt: true, priority: true },
      }),

      db.request.findMany({
        where: { resolvedAt: { not: null, gte: monthStart(MONTHS) } },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);

  // --- occupancy -----------------------------------------------------------
  const byStatus = new Map(unitCounts.map((row) => [row.status, row._count._all]));
  const totalUnits = unitCounts.reduce((sum, row) => sum + row._count._all, 0);
  const occupiedUnits = byStatus.get("OCCUPIED") ?? 0;

  // --- rent collected, bucketed by month ----------------------------------
  const collectedByMonth = new Map<string, number>();
  const billedByMonth = new Map<string, number>();

  for (const payment of payments) {
    const key = monthKey(payment.dueDate);
    billedByMonth.set(key, (billedByMonth.get(key) ?? 0) + payment.amountCents);
    if (payment.paidAt !== null) {
      collectedByMonth.set(key, (collectedByMonth.get(key) ?? 0) + payment.amountCents);
    }
  }

  // Every month in the window gets a point, including one where nothing was
  // collected. A chart that silently omits empty months compresses its own
  // x-axis and shows a trend that did not happen.
  const rentCollected: MonthPointDTO[] = Array.from({ length: MONTHS }, (_, i) => {
    const start = monthStart(MONTHS - 1 - i);
    const key = monthKey(start);
    return { month: start, valueCents: collectedByMonth.get(key) ?? 0 };
  });

  const thisMonthKey = monthKey(thisMonthStart);
  const lastMonthKey = monthKey(lastMonthStart);
  const collectedThisMonth = collectedByMonth.get(thisMonthKey) ?? 0;
  const collectedLastMonth = collectedByMonth.get(lastMonthKey) ?? 0;
  const billedThisMonth = billedByMonth.get(thisMonthKey) ?? 0;

  // --- requests ------------------------------------------------------------
  const openedThisMonth = openRequests.filter(
    (request) => request.createdAt >= thisMonthStart,
  ).length;
  const openedLastMonth = openRequests.filter(
    (request) =>
      request.createdAt >= lastMonthStart && request.createdAt < thisMonthStart,
  ).length;

  const resolutionDays = resolvedRequests.map(
    (request) =>
      (request.resolvedAt!.getTime() - request.createdAt.getTime()) / 86_400_000,
  );

  const averageResolutionDays =
    resolutionDays.length === 0
      ? 0
      : resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length;

  return {
    occupancy: {
      occupied: occupiedUnits,
      total: totalUnits,
      // Guarded: an empty database would otherwise render "NaN%" as the single
      // largest thing on the page.
      ratio: totalUnits === 0 ? 0 : occupiedUnits / totalUnits,
      vacant: byStatus.get("VACANT") ?? 0,
      maintenance: byStatus.get("MAINTENANCE") ?? 0,
      reserved: byStatus.get("RESERVED") ?? 0,
    },
    byCommunity: communities.map((community) => {
      const total = community.units.length;
      const occupied = community.units.filter((u) => u.status === "OCCUPIED").length;
      return {
        id: community.id,
        name: community.name,
        occupied,
        total,
        ratio: total === 0 ? 0 : occupied / total,
      };
    }),
    rentCollected,
    collectedThisMonthCents: collectedThisMonth,
    billedThisMonthCents: billedThisMonth,
    collectionRatio: billedThisMonth === 0 ? 0 : collectedThisMonth / billedThisMonth,
    collectedDelta: ratioChange(collectedThisMonth, collectedLastMonth),
    openRequestCount: openRequests.length,
    urgentRequestCount: openRequests.filter((r) => r.priority === "URGENT").length,
    openedDelta: ratioChange(openedThisMonth, openedLastMonth),
    averageResolutionDays,
  };
}

/**
 * Proportional change, as a ratio for `formatDelta`.
 *
 * Returns 0 when the previous value was 0. The arithmetically honest answer is
 * infinity, and "+∞%" in a stat tile reads as a rendering bug rather than as
 * growth from nothing.
 */
function ratioChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return (current - previous) / previous;
}

/**
 * The overview's first list: open requests, most urgent first.
 *
 * Ordered by priority then age rather than by age alone. A three-day-old
 * URGENT above a three-week-old LOW is the ordering a manager actually wants,
 * and "sorted by newest" is the default that makes a dashboard useless.
 */
export async function getRequestsNeedingAttention(
  take = 6,
): Promise<RequestSummaryDTO[]> {
  await requireManager();

  const rows = await db.request.findMany({
    where: { status: { not: "RESOLVED" } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take,
    select: {
      id: true,
      title: true,
      category: true,
      priority: true,
      status: true,
      createdAt: true,
      unit: { select: { label: true, community: { select: { name: true } } } },
      resident: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    priority: row.priority,
    status: row.status,
    createdAt: row.createdAt,
    unitLabel: row.unit.label,
    communityName: row.unit.community.name,
    residentName: row.resident.name,
  }));
}

/**
 * The overview's second list: overdue rent, oldest debt first.
 *
 * `daysLate` is computed here rather than in the component so the server render
 * and any later client render cannot disagree about it -- a value derived from
 * `Date.now()` at render time is a hydration mismatch waiting for midnight.
 */
export async function getLatePayments(take = 6): Promise<LatePaymentDTO[]> {
  await requireManager();

  const rows = await db.payment.findMany({
    // Outstanding means UNPAID and past due -- `paidAt: null` plus a due date
    // in the past. Deliberately not `status: "LATE"`: in this schema LATE means
    // "paid, but after the due date", so it carries a paidAt and is money that
    // has arrived. Querying on it produced "548 days late" for rent that was
    // settled eighteen months ago, which is the kind of number that tells a
    // visitor the whole screen is fake.
    where: { paidAt: null, dueDate: { lt: new Date() } },
    orderBy: { dueDate: "asc" },
    take,
    select: {
      id: true,
      amountCents: true,
      dueDate: true,
      lease: {
        select: {
          resident: { select: { name: true } },
          unit: { select: { label: true, community: { select: { name: true } } } },
        },
      },
    },
  });

  const now = Date.now();

  return rows.map((row) => ({
    id: row.id,
    amountCents: row.amountCents,
    dueDate: row.dueDate,
    unitLabel: row.lease.unit.label,
    communityName: row.lease.unit.community.name,
    residentName: row.lease.resident.name,
    daysLate: Math.max(0, Math.floor((now - row.dueDate.getTime()) / 86_400_000)),
  }));
}
