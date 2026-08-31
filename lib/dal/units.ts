import "server-only";

import { requireManager } from "@/lib/dal";
import { db } from "@/lib/db";
import type { UnitDetailDTO, UnitRowDTO } from "@/lib/dto";
import { compareNatural } from "@/lib/sort";

/**
 * The units table — spec §1's "real interface density" claim, made concrete.
 *
 * Manager-only, guarded by role rather than ownership: a manager legitimately
 * sees every unit in the portfolio.
 */

export type UnitSortKey = "label" | "community" | "bedrooms" | "rent" | "status";
export type SortDirection = "asc" | "desc";

export type UnitFilters = {
  communityId?: string;
  status?: "OCCUPIED" | "VACANT" | "MAINTENANCE" | "RESERVED";
  bedrooms?: number;
  /** Matches a unit label or the current resident's name. */
  query?: string;
  sort?: UnitSortKey;
  direction?: SortDirection;
};

const UNIT_ROW_SELECT = {
  id: true,
  label: true,
  bedrooms: true,
  baths: true,
  sqft: true,
  monthlyRent: true,
  status: true,
  community: { select: { id: true, name: true } },
  leases: {
    where: { status: "ACTIVE" as const },
    select: { id: true, resident: { select: { id: true, name: true } } },
    // A unit has at most one active lease, but `findMany` on a relation cannot
    // express that. Taking one keeps a data error from silently becoming a
    // duplicate row in the table.
    take: 1,
  },
} as const;

export async function getUnitsForManager(
  filters: UnitFilters = {},
): Promise<UnitRowDTO[]> {
  await requireManager();

  const query = filters.query?.trim();

  const rows = await db.unit.findMany({
    where: {
      communityId: filters.communityId,
      status: filters.status,
      bedrooms: filters.bedrooms,
      ...(query
        ? {
            OR: [
              { label: { contains: query, mode: "insensitive" as const } },
              {
                leases: {
                  some: {
                    status: "ACTIVE" as const,
                    resident: {
                      name: { contains: query, mode: "insensitive" as const },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    select: UNIT_ROW_SELECT,
  });

  const mapped: UnitRowDTO[] = rows.map((row) => ({
    id: row.id,
    label: row.label,
    communityId: row.community.id,
    communityName: row.community.name,
    bedrooms: row.bedrooms,
    baths: row.baths,
    sqft: row.sqft,
    monthlyRentCents: row.monthlyRent,
    status: row.status,
    residentId: row.leases[0]?.resident.id ?? null,
    residentName: row.leases[0]?.resident.name ?? null,
  }));

  return sortUnits(mapped, filters.sort ?? "label", filters.direction ?? "asc");
}

/**
 * Sorted in JavaScript, not in Postgres, and that is deliberate.
 *
 * Unit labels are `1A, 2B, 10C, 14B` — a plain SQL `ORDER BY label` puts "10C"
 * before "2B" because "1" < "2", and nobody scanning a rent roll reads that as
 * sorted. `compareNatural` uses `Intl.Collator` with `numeric: true`, which has
 * no SQL equivalent short of a custom collation.
 *
 * The trade is that the whole filtered set has to be in memory. At 42 units
 * that is free. If this ever paginates, the label sort needs a generated
 * sort-key column rather than a naive move back to `ORDER BY`.
 */
function sortUnits(
  units: UnitRowDTO[],
  key: UnitSortKey,
  direction: SortDirection,
): UnitRowDTO[] {
  const sign = direction === "asc" ? 1 : -1;

  return [...units].sort((a, b) => {
    switch (key) {
      case "community":
        // Ties fall back to the label, so the secondary order is stable and
        // meaningful rather than whatever Postgres happened to return.
        return (
          sign * compareNatural(a.communityName, b.communityName) ||
          compareNatural(a.label, b.label)
        );
      case "bedrooms":
        return sign * (a.bedrooms - b.bedrooms) || compareNatural(a.label, b.label);
      case "rent":
        return (
          sign * (a.monthlyRentCents - b.monthlyRentCents) ||
          compareNatural(a.label, b.label)
        );
      case "status":
        return sign * a.status.localeCompare(b.status) || compareNatural(a.label, b.label);
      case "label":
      default:
        return sign * compareNatural(a.label, b.label);
    }
  });
}

/** The values the filter controls offer, derived from the data that exists. */
export async function getUnitFilterOptions() {
  await requireManager();

  const [communities, bedrooms] = await Promise.all([
    db.community.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    // Offering "4 bedrooms" when no four-bedroom unit exists produces a filter
    // that can only ever return the empty state.
    db.unit.findMany({
      select: { bedrooms: true },
      distinct: ["bedrooms"],
      orderBy: { bedrooms: "asc" },
    }),
  ]);

  return {
    communities,
    bedrooms: bedrooms.map((row) => row.bedrooms),
  };
}

/**
 * One unit, with everything the detail screen shows.
 *
 * Returns `null` for an unknown id rather than throwing, so the route can call
 * `notFound()`. See the note in dal/requests.ts on why the DAL reports facts
 * and the route decides the status code.
 */
export async function getUnitForManager(
  unitId: string,
): Promise<UnitDetailDTO | null> {
  await requireManager();

  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: {
      id: true,
      label: true,
      bedrooms: true,
      baths: true,
      sqft: true,
      monthlyRent: true,
      status: true,
      community: { select: { id: true, name: true, city: true, state: true } },
      leases: {
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          monthlyRent: true,
          resident: { select: { id: true, name: true, email: true, phone: true } },
          payments: {
            orderBy: { dueDate: "desc" },
            take: 6,
            select: {
              id: true,
              amountCents: true,
              dueDate: true,
              paidAt: true,
              status: true,
              method: true,
            },
          },
        },
      },
      requests: {
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          title: true,
          category: true,
          priority: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  if (!unit) return null;

  const active = unit.leases.find((lease) => lease.status === "ACTIVE") ?? null;

  // Leases come back newest-first, so the first non-active one ended most
  // recently. Only meaningful when there is no active lease.
  const lastEnded = active
    ? null
    : (unit.leases.find((lease) => lease.status === "ENDED") ?? null);
  const vacantSince = lastEnded?.endDate ?? null;

  return {
    id: unit.id,
    label: unit.label,
    bedrooms: unit.bedrooms,
    baths: unit.baths,
    sqft: unit.sqft,
    monthlyRentCents: unit.monthlyRent,
    status: unit.status,
    community: unit.community,
    activeLease: active
      ? {
          id: active.id,
          startDate: active.startDate,
          endDate: active.endDate,
          monthlyRentCents: active.monthlyRent,
          resident: active.resident,
          payments: active.payments.map((payment) => ({
            id: payment.id,
            amountCents: payment.amountCents,
            dueDate: payment.dueDate,
            paidAt: payment.paidAt,
            status: payment.status,
            method: payment.method,
          })),
        }
      : null,
    pastLeases: unit.leases
      .filter((lease) => lease.status !== "ACTIVE")
      .map((lease) => ({
        id: lease.id,
        status: lease.status,
        startDate: lease.startDate,
        endDate: lease.endDate,
        residentName: lease.resident.name,
      })),
    vacantSince,
    daysVacant:
      vacantSince === null
        ? null
        : Math.max(
            0,
            Math.floor((Date.now() - vacantSince.getTime()) / 86_400_000),
          ),
    requests: unit.requests,
  };
}
