import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/empty-state";
import { Status, type Tone } from "@/components/ui/status";
import {
  HeaderRow,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui/table";
import { getUnitForManager } from "@/lib/dal/units";
import { formatBedrooms, formatEnumLabel } from "@/lib/format";
import { formatMoney } from "@/lib/money";

/**
 * One unit.
 *
 * The plan calls for **occupied and vacant compositions**, and they are
 * genuinely different layouts rather than one layout with empty slots. A vacant
 * unit has no resident, no lease and no payments, so the occupied version of
 * this page would be three-quarters empty states -- which reads as broken data
 * rather than as an available apartment. The vacant view leads with what a
 * manager actually needs: how long it has been empty, what it last rented for,
 * and what is outstanding before it can be shown.
 */

const STATUS_TONE: Record<string, Tone> = {
  OCCUPIED: "good",
  VACANT: "serious",
  MAINTENANCE: "warning",
  RESERVED: "neutral",
};

const PAYMENT_TONE: Record<string, Tone> = {
  PAID: "good",
  DUE: "warning",
  LATE: "critical",
};

const PRIORITY_TONE: Record<string, Tone> = {
  URGENT: "critical",
  NORMAL: "warning",
  LOW: "neutral",
};

const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export async function generateMetadata({ params }: PageProps<"/app/units/[id]">) {
  const { id } = await params;
  const unit = await getUnitForManager(id);
  return { title: unit ? `Unit ${unit.label}` : "Unit" };
}

export default async function UnitDetailPage({ params }: PageProps<"/app/units/[id]">) {
  const { id } = await params;
  const unit = await getUnitForManager(id);

  // The DAL returns null for an unknown id and the route decides the status
  // code. 404 rather than an error page: there is nothing to fix.
  if (!unit) notFound();

  const occupied = unit.activeLease !== null;

  return (
    <div className="flex flex-col gap-loose py-tight">
      <header className="flex flex-col gap-tight">
        <Link
          href="/app/units"
          className="eyebrow w-fit underline decoration-rule underline-offset-4 transition-colors duration-200 ease-[var(--ease-standard)] hover:text-ink hover:decoration-ink-muted"
        >
          All units
        </Link>

        <div className="flex flex-wrap items-baseline justify-between gap-tight">
          <div className="flex flex-wrap items-baseline gap-x-tight">
            <h1 className="text-title text-ink">Unit {unit.label}</h1>
            <p className="text-body text-ink-2">
              {unit.community.name} · {unit.community.city}, {unit.community.state}
            </p>
          </div>
          <Status tone={STATUS_TONE[unit.status] ?? "neutral"}>
            {formatEnumLabel(unit.status)}
          </Status>
        </div>

        <dl className="flex flex-wrap gap-x-loose gap-y-tight border-y border-rule py-tight">
          {[
            ["Bedrooms", formatBedrooms(unit.bedrooms)],
            ["Bathrooms", String(unit.baths)],
            ["Floor area", `${unit.sqft.toLocaleString("en-US")} sq ft`],
            [occupied ? "Rent" : "Asking rent", formatMoney(unit.monthlyRentCents)],
          ].map(([term, value]) => (
            <div key={term}>
              <dt className="eyebrow">{term}</dt>
              <dd className="figures-tabular text-body text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {occupied ? (
        <OccupiedView unit={unit} />
      ) : (
        <VacantView unit={unit} />
      )}

      <section className="flex flex-col gap-tight">
        <h2 className="eyebrow">Maintenance history</h2>
        {unit.requests.length === 0 ? (
          <EmptyState
            title="No maintenance requests"
            description="Nothing has been reported for this unit."
          />
        ) : (
          <ul className="divide-y divide-rule border-t border-rule">
            {unit.requests.map((request) => (
              <li key={request.id} className="flex flex-wrap items-baseline justify-between gap-tight py-tight">
                <div>
                  <p className="text-body text-ink">{request.title}</p>
                  <p className="text-caption text-ink-muted">
                    {request.category} · {DATE.format(request.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-base">
                  <Status tone={PRIORITY_TONE[request.priority] ?? "neutral"}>
                    {request.priority.toLowerCase()}
                  </Status>
                  <span className="text-caption text-ink-2">
                    {formatEnumLabel(request.status)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Occupied: who lives here, on what terms, and are they paying. */
function OccupiedView({ unit }: { unit: NonNullable<Awaited<ReturnType<typeof getUnitForManager>>> }) {
  const lease = unit.activeLease!;

  return (
    <div className="grid gap-loose lg:grid-cols-[2fr_3fr]">
      <section className="flex flex-col gap-tight">
        <h2 className="eyebrow">Resident</h2>
        <div className="border-t border-rule pt-tight">
          <p className="text-body text-ink">{lease.resident.name}</p>
          <p className="text-caption text-ink-2">{lease.resident.email}</p>
          {lease.resident.phone && (
            <p className="text-caption text-ink-2">{lease.resident.phone}</p>
          )}
        </div>

        <h2 className="eyebrow mt-base">Lease</h2>
        <dl className="flex flex-col gap-1 border-t border-rule pt-tight">
          <div className="flex justify-between gap-tight">
            <dt className="text-caption text-ink-muted">Term</dt>
            <dd className="text-caption text-ink">
              {DATE.format(lease.startDate)} — {DATE.format(lease.endDate)}
            </dd>
          </div>
          <div className="flex justify-between gap-tight">
            <dt className="text-caption text-ink-muted">Monthly rent</dt>
            <dd className="figures-tabular text-caption text-ink">
              {formatMoney(lease.monthlyRentCents)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-tight">
        <h2 className="eyebrow">Recent payments</h2>
        {lease.payments.length === 0 ? (
          <EmptyState
            title="No payments yet"
            description="This lease has not reached its first due date."
          />
        ) : (
          <Table caption={`Recent payments for unit ${unit.label}.`}>
            <THead>
              <HeaderRow>
                <Th scope="col">Due</Th>
                <Th scope="col" numeric>
                  Amount
                </Th>
                <Th scope="col">Method</Th>
                <Th scope="col">Status</Th>
              </HeaderRow>
            </THead>
            <TBody>
              {lease.payments.map((payment) => (
                <Tr key={payment.id}>
                  <Th scope="row" className="whitespace-nowrap">
                    {DATE.format(payment.dueDate)}
                  </Th>
                  <Td numeric>{formatMoney(payment.amountCents)}</Td>
                  <Td className="text-ink-2">{payment.method}</Td>
                  <Td>
                    <Status tone={PAYMENT_TONE[payment.status] ?? "neutral"}>
                      {formatEnumLabel(payment.status)}
                    </Status>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </div>
  );
}

/**
 * Vacant: how long, what it last earned, and what is in the way.
 *
 * Not the occupied layout with holes in it. The questions a manager has about
 * an empty unit are different questions.
 */
function VacantView({ unit }: { unit: NonNullable<Awaited<ReturnType<typeof getUnitForManager>>> }) {
  const lastLease = unit.pastLeases[0] ?? null;
  const openWork = unit.requests.filter((request) => request.status !== "RESOLVED");

  // Both computed in the DAL -- see the note on `daysVacant` in lib/dto.ts.
  const { vacantSince, daysVacant } = unit;

  return (
    <div className="grid gap-loose lg:grid-cols-[2fr_3fr]">
      <section className="flex flex-col gap-tight">
        <h2 className="eyebrow">Availability</h2>
        <dl className="flex flex-col gap-1 border-t border-rule pt-tight">
          <div className="flex justify-between gap-tight">
            <dt className="text-caption text-ink-muted">Vacant since</dt>
            <dd className="text-caption text-ink">
              {vacantSince ? DATE.format(vacantSince) : "Never let"}
            </dd>
          </div>
          {daysVacant !== null && (
            <div className="flex justify-between gap-tight">
              <dt className="text-caption text-ink-muted">Days empty</dt>
              <dd className="figures-tabular text-caption text-ink">{daysVacant}</dd>
            </div>
          )}
          <div className="flex justify-between gap-tight">
            <dt className="text-caption text-ink-muted">Asking rent</dt>
            <dd className="figures-tabular text-caption text-ink">
              {formatMoney(unit.monthlyRentCents)}
            </dd>
          </div>
          {lastLease && (
            <div className="flex justify-between gap-tight">
              <dt className="text-caption text-ink-muted">Last resident</dt>
              <dd className="text-caption text-ink">{lastLease.residentName}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="flex flex-col gap-tight">
        <h2 className="eyebrow">Before it can be shown</h2>
        {openWork.length === 0 ? (
          <EmptyState
            icon="check"
            title="Ready to show"
            description="No outstanding maintenance on this unit."
          />
        ) : (
          <ul className="divide-y divide-rule border-t border-rule">
            {openWork.map((request) => (
              <li key={request.id} className="flex items-baseline justify-between gap-tight py-tight">
                <div>
                  <p className="text-body text-ink">{request.title}</p>
                  <p className="text-caption text-ink-muted">{request.category}</p>
                </div>
                <Status tone={PRIORITY_TONE[request.priority] ?? "neutral"}>
                  {request.priority.toLowerCase()}
                </Status>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
