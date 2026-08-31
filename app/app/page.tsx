import Link from "next/link";

import { ChartFrame } from "@/components/charts/chart-frame";
import { HBarChart } from "@/components/charts/h-bar-chart";
import { LineChart } from "@/components/charts/line-chart";
import { Meter } from "@/components/charts/meter";
import { StatTile } from "@/components/app/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { Status, type Tone } from "@/components/ui/status";
import {
  getLatePayments,
  getManagerOverview,
  getRequestsNeedingAttention,
} from "@/lib/dal/dashboard";
import {
  formatMoney,
  formatMoneyAxis,
  formatMoneyWhole,
  formatPercent,
} from "@/lib/money";

/**
 * The manager overview — the screen a prospect judges the project on.
 *
 * Layout follows the reading order a manager actually has: how full are we,
 * then is the money arriving, then what needs doing today. The hero figure
 * answers the first question before anything else is read.
 *
 * Everything on this page is an aggregate over the same rows the units table
 * and the ledger show. Nothing is precomputed and nothing is hardcoded, which
 * is what stops the dashboard drifting away from the screens beneath it.
 */

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const PRIORITY_TONE: Record<string, Tone> = {
  URGENT: "critical",
  NORMAL: "warning",
  LOW: "neutral",
};

export default async function ManagerOverview() {
  const [overview, requests, latePayments] = await Promise.all([
    getManagerOverview(),
    getRequestsNeedingAttention(),
    getLatePayments(),
  ]);

  const { occupancy } = overview;
  const monthLabels = overview.rentCollected.map((point) =>
    MONTH_FORMAT.format(point.month),
  );
  const monthValues = overview.rentCollected.map((point) => point.valueCents);

  return (
    <div className="flex flex-col gap-loose py-tight">
      {/* --- hero ----------------------------------------------------------- */}
      <header className="flex flex-col gap-tight">
        <h1 className="font-display text-display-sm text-ink">Overview</h1>

        <div className="flex flex-wrap items-baseline gap-x-base gap-y-tight">
          {/* The one hero figure on the page, and the single place Playfair is
              allowed inside the app. Proportional figures on purpose: at 56px
              tabular spacing makes a number like 76 look gappy, and §8 reserves
              tabular for columns and ticks. */}
          <p className="font-display text-figure leading-none text-ink">
            {formatPercent(occupancy.ratio, 0)}
          </p>
          <p className="text-body text-ink-2">
            occupied — {occupancy.occupied} of {occupancy.total} units
          </p>
        </div>

        {/* The remainder, so the hero figure is never the only account of the
            portfolio. A number with no breakdown invites the question this
            line answers. */}
        <p className="text-caption text-ink-muted">
          {occupancy.vacant} vacant · {occupancy.maintenance} in maintenance ·{" "}
          {occupancy.reserved} reserved
        </p>
      </header>

      {/* --- stat tiles ----------------------------------------------------- */}
      <section
        aria-label="This month"
        className="grid gap-base sm:grid-cols-2 lg:grid-cols-3"
      >
        <StatTile
          label="Rent collected"
          value={formatMoneyWhole(overview.collectedThisMonthCents)}
          delta={overview.collectedDelta}
          goodDirection="up"
          trend={monthValues}
          trendLabel={`Rent collected over the last ${monthValues.length} months`}
        />
        <StatTile
          label="Open requests"
          value={String(overview.openRequestCount)}
          delta={overview.openedDelta}
          // More requests opening is not good news, so the arrow's colour has
          // to invert. This is the tile the default would get wrong.
          goodDirection="down"
          deltaLabel="opened vs last month"
        />
        <StatTile
          label="Average time to resolve"
          value={`${overview.averageResolutionDays.toFixed(1)} days`}
          goodDirection="down"
        />
      </section>

      {/* --- charts --------------------------------------------------------- */}
      <section className="grid gap-loose lg:grid-cols-[3fr_2fr]">
        <ChartFrame
          title="Rent collected"
          caption="Rent received, counted against the month it was due rather than the month it arrived — so a payment made two weeks late still lands in the month it was owed. Rent still outstanding is not counted."
          table={{
            headers: ["Month", "Collected"],
            rows: overview.rentCollected.map((point) => [
              MONTH_FORMAT.format(point.month),
              formatMoney(point.valueCents),
            ]),
          }}
        >
          <LineChart
            values={monthValues}
            labels={monthLabels}
            formatValue={formatMoney}
            formatTick={formatMoneyAxis}
          />
        </ChartFrame>

        <div className="flex flex-col gap-loose">
          <ChartFrame
            title="Occupancy by community"
            caption="Occupied units as a share of each community's total."
            table={{
              headers: ["Community", "Occupied", "Total", "Rate"],
              rows: overview.byCommunity.map((community) => [
                community.name,
                community.occupied,
                community.total,
                formatPercent(community.ratio, 0),
              ]),
            }}
          >
            <HBarChart
              data={overview.byCommunity.map((community) => ({
                label: community.name,
                value: community.occupied,
                max: community.total,
              }))}
              formatValue={(value, max) => `${value} of ${max}`}
            />
          </ChartFrame>

          <Meter
            ratio={overview.collectionRatio}
            label="Collected this month"
            valueLabel={`${formatMoneyWhole(overview.collectedThisMonthCents)} of ${formatMoneyWhole(overview.billedThisMonthCents)}`}
          />
        </div>
      </section>

      {/* --- lists ---------------------------------------------------------- */}
      <section className="grid gap-loose lg:grid-cols-2">
        <div className="flex flex-col gap-tight">
          <div className="flex items-baseline justify-between gap-tight">
            <h2 className="eyebrow">Needs attention</h2>
            <Link
              href="/app/requests"
              className="eyebrow underline decoration-rule underline-offset-4 transition-colors duration-200 ease-[var(--ease-standard)] hover:text-ink hover:decoration-ink-muted"
            >
              All requests
            </Link>
          </div>

          {requests.length === 0 ? (
            <EmptyState
              title="Nothing open"
              description="Every maintenance request has been resolved."
            />
          ) : (
            <ul className="divide-y divide-rule border-t border-rule">
              {requests.map((request) => (
                <li key={request.id} className="py-tight">
                  <div className="flex items-baseline justify-between gap-tight">
                    <p className="text-body text-ink">{request.title}</p>
                    <Status tone={PRIORITY_TONE[request.priority] ?? "neutral"}>
                      {request.priority.toLowerCase()}
                    </Status>
                  </div>
                  <p className="text-caption text-ink-muted">
                    {request.communityName} · {request.unitLabel} ·{" "}
                    {request.residentName}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-tight">
          <div className="flex items-baseline justify-between gap-tight">
            <h2 className="eyebrow">Overdue rent</h2>
            <Link
              href="/app/payments"
              className="eyebrow underline decoration-rule underline-offset-4 transition-colors duration-200 ease-[var(--ease-standard)] hover:text-ink hover:decoration-ink-muted"
            >
              Full ledger
            </Link>
          </div>

          {latePayments.length === 0 ? (
            <EmptyState
              title="Nothing overdue"
              description="Every payment due this month has been received."
            />
          ) : (
            <ul className="divide-y divide-rule border-t border-rule">
              {latePayments.map((payment) => (
                <li key={payment.id} className="py-tight">
                  <div className="flex items-baseline justify-between gap-tight">
                    <p className="text-body text-ink">{payment.residentName}</p>
                    <p className="figures-tabular text-body text-ink">
                      {formatMoney(payment.amountCents)}
                    </p>
                  </div>
                  <p className="text-caption text-ink-muted">
                    {payment.communityName} · {payment.unitLabel} ·{" "}
                    {payment.daysLate} days late
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
