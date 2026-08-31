import { UnitsFilters } from "@/components/app/units-filters";
import { EmptyState } from "@/components/ui/empty-state";
import { Status, type Tone } from "@/components/ui/status";
import {
  HeaderRow,
  RowLink,
  SortableTh,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui/table";
import {
  getUnitFilterOptions,
  getUnitsForManager,
  type SortDirection,
  type UnitSortKey,
} from "@/lib/dal/units";
import { formatBedrooms } from "@/lib/format";
import { formatMoney } from "@/lib/money";

/**
 * The rent roll — the density showcase.
 *
 * Filters and sort live entirely in the URL, which makes this a server
 * component with no client state at all. The consequences are worth stating,
 * because the client-state version is the obvious build:
 *
 *  - A filtered, sorted view can be pasted to a colleague and they see it.
 *  - Reload, back and forward all behave.
 *  - It renders before any JavaScript has run.
 *
 * The only client component on the page is the filter row, and all it adds is
 * auto-submit on change.
 */

export const metadata = { title: "Units" };

const STATUS_TONE: Record<string, Tone> = {
  OCCUPIED: "good",
  VACANT: "serious",
  MAINTENANCE: "warning",
  RESERVED: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  OCCUPIED: "Occupied",
  VACANT: "Vacant",
  MAINTENANCE: "Maintenance",
  RESERVED: "Reserved",
};

const SORT_KEYS: UnitSortKey[] = ["label", "community", "bedrooms", "rent", "status"];

function isSortKey(value: string | undefined): value is UnitSortKey {
  return value !== undefined && (SORT_KEYS as string[]).includes(value);
}

/** First value only. `?status=A&status=B` would otherwise reach Prisma as an array. */
function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function UnitsPage({
  searchParams,
}: PageProps<"/app/units">) {
  const params = await searchParams;

  const communityId = one(params.community) || undefined;
  const statusParam = one(params.status) || undefined;
  const bedroomsParam = one(params.beds) || undefined;
  const query = one(params.q) || undefined;

  // Validated against the known set rather than passed through. An unknown
  // sort key would otherwise fall to the default silently while the header
  // showed no active column -- and an unknown status would reach Prisma as an
  // invalid enum and throw a 500 on a URL anyone can type.
  const sort = isSortKey(one(params.sort)) ? (one(params.sort) as UnitSortKey) : "label";
  const direction: SortDirection = one(params.direction) === "desc" ? "desc" : "asc";
  const status =
    statusParam && statusParam in STATUS_TONE
      ? (statusParam as "OCCUPIED" | "VACANT" | "MAINTENANCE" | "RESERVED")
      : undefined;
  const bedrooms =
    bedroomsParam && /^\d+$/.test(bedroomsParam) ? Number(bedroomsParam) : undefined;

  const [units, options] = await Promise.all([
    getUnitsForManager({ communityId, status, bedrooms, query, sort, direction }),
    getUnitFilterOptions(),
  ]);

  /** Same filters, new sort. Clicking the active column flips its direction. */
  function sortHref(key: UnitSortKey): string {
    const next = new URLSearchParams();
    if (communityId) next.set("community", communityId);
    if (status) next.set("status", status);
    if (bedrooms !== undefined) next.set("beds", String(bedrooms));
    if (query) next.set("q", query);
    next.set("sort", key);
    next.set("direction", sort === key && direction === "asc" ? "desc" : "asc");
    return `/app/units?${next.toString()}`;
  }

  const activeDirection = (key: UnitSortKey) => (sort === key ? direction : undefined);

  return (
    <div className="flex flex-col gap-base py-tight">
      <header className="flex flex-wrap items-baseline justify-between gap-tight">
        <h1 className="text-title text-ink">Units</h1>
        <p className="text-caption text-ink-muted">
          {units.length} {units.length === 1 ? "unit" : "units"}
        </p>
      </header>

      <UnitsFilters
        communities={options.communities}
        bedrooms={options.bedrooms}
        current={{
          communityId,
          status,
          bedrooms: bedrooms === undefined ? undefined : String(bedrooms),
          query,
          sort,
          direction,
        }}
      />

      {units.length === 0 ? (
        <EmptyState
          icon="search"
          title="No units match these filters"
          description="Try a different community or status, or clear the filters to see the whole portfolio."
        />
      ) : (
        <Table caption="Units in the portfolio, with community, size, rent, status and current resident.">
          {/* Sticky so the column heads stay while a forty-row rent roll
              scrolls. It needs an opaque background or the rows show through. */}
          <THead sticky>
            <HeaderRow>
              <SortableTh href={sortHref("label")} direction={activeDirection("label")}>
                Unit
              </SortableTh>
              <SortableTh
                href={sortHref("community")}
                direction={activeDirection("community")}
              >
                Community
              </SortableTh>
              <SortableTh
                href={sortHref("bedrooms")}
                direction={activeDirection("bedrooms")}
                numeric
              >
                Beds
              </SortableTh>
              <Th scope="col" numeric>
                Sq ft
              </Th>
              <SortableTh href={sortHref("rent")} direction={activeDirection("rent")} numeric>
                Rent
              </SortableTh>
              <SortableTh href={sortHref("status")} direction={activeDirection("status")}>
                Status
              </SortableTh>
              <Th scope="col">Resident</Th>
            </HeaderRow>
          </THead>

          <TBody>
            {units.map((unit) => (
              <Tr key={unit.id}>
                <Th scope="row">
                  <RowLink href={`/app/units/${unit.id}`}>{unit.label}</RowLink>
                </Th>
                <Td>{unit.communityName}</Td>
                <Td numeric>{formatBedrooms(unit.bedrooms)}</Td>
                <Td numeric>{unit.sqft.toLocaleString("en-US")}</Td>
                <Td numeric>{formatMoney(unit.monthlyRentCents)}</Td>
                <Td>
                  <Status tone={STATUS_TONE[unit.status] ?? "neutral"}>
                    {STATUS_LABEL[unit.status] ?? unit.status}
                  </Status>
                </Td>
                <Td className="text-ink-2">
                  {/* An em dash, not an empty cell: a blank reads as missing
                      data, where this reads as "nobody lives here". */}
                  {unit.residentName ?? "—"}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
