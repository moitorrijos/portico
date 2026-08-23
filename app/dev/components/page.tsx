import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { EmptyState, NoResults } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Delta, Status } from "@/components/ui/status";
import {
  HeaderRow,
  TBody,
  THead,
  Table,
  Th,
} from "@/components/ui/table";
import { LoadingRegion, Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UnitsDemo } from "./units-demo";

export const metadata: Metadata = { title: "Components" };

/* Request-time, same reason as /dev/tokens and app/robots.ts: a build-time
   APP_ENV check would be baked in and the page served in production anyway. */
export const dynamic = "force-dynamic";

export default function ComponentsPage() {
  if (process.env.APP_ENV === "production") notFound();

  return (
    <main className="mx-auto w-full max-w-4xl px-base py-loose">
      <header className="mb-loose flex items-baseline justify-between gap-base border-b border-rule pb-base">
        <div>
          <p className="eyebrow mb-tight">Design system</p>
          <h1 className="font-display text-display-sm text-ink">Components</h1>
        </div>
        <ThemeToggle />
      </header>

      <Section
        eyebrow="Action"
        title="Buttons"
        note="One accent, so exactly one variant is filled. Hover moves the border or the ink — never the elevation, because §7 rules out shadows."
      >
        <div className="flex flex-wrap items-center gap-base">
          <Button variant="primary">Save changes</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="ghost">Clear filters</Button>
          <Button variant="danger">End lease</Button>
          <Button variant="secondary" size="small">
            Small
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </Section>

      <Section
        eyebrow="Input"
        title="Form controls"
        note="Field hands the control its id and aria wiring through a render prop, so a hint or error cannot be visually present but unannounced."
      >
        <div className="grid gap-base sm:grid-cols-2">
          <Field id="demo-search" label="Search units" hint="Matches label or resident name.">
            {(control) => (
              <Input {...control} icon="search" placeholder="Unit 14B" />
            )}
          </Field>

          <Field id="demo-community" label="Community">
            {(control) => (
              <Select {...control} defaultValue="">
                <option value="">All communities</option>
                <option value="alder">Alder Court</option>
                <option value="linden">Linden Row</option>
                <option value="sable">Sable Yard</option>
              </Select>
            )}
          </Field>

          <Field
            id="demo-rent"
            label="Monthly rent"
            required
            hint="Whole dollars. Stored as integer cents."
          >
            {(control) => <Input {...control} numeric placeholder="1,850" />}
          </Field>

          <Field
            id="demo-invalid"
            label="Move-in date"
            error="Enter a date on or after the lease start."
          >
            {(control) => <Input {...control} type="date" />}
          </Field>
        </div>
      </Section>

      <Section
        eyebrow="State"
        title="Status"
        note="Icon and label and colour, always together. There is no API here that renders a bare coloured dot — the icon is picked by tone and the label is required."
      >
        <div className="flex flex-wrap items-center gap-loose border-y border-rule py-base">
          <Status tone="good">Paid</Status>
          <Status tone="warning">Due in 3 days</Status>
          <Status tone="serious">Late</Status>
          <Status tone="critical">Missed</Status>
          <Status tone="neutral">Upcoming</Status>
        </div>
      </Section>

      <Section
        eyebrow="State"
        title="Deltas"
        note="Up is not universally good. Rent collected rising is healthy; average days-to-resolve rising is not — so direction and sentiment are separate props."
      >
        <dl className="grid gap-base border-y border-rule py-base sm:grid-cols-3">
          <StatTile label="Rent collected" value="$148,320" ratio={0.041} goodDirection="up" />
          <StatTile label="Open requests" value="12" ratio={0.176} goodDirection="down" />
          <StatTile label="Avg days to resolve" value="2.4" ratio={-0.083} goodDirection="down" />
        </dl>
      </Section>

      <Section
        eyebrow="Density"
        title="Table"
        note="Real th with a required scope, aria-sort on the header rather than the button, tabular figures on numeric columns, and a stretched link so the whole row is clickable while staying one real tab stop."
      >
        <UnitsDemo />
      </Section>

      <Section
        eyebrow="Density"
        title="Loading"
        note="Column widths mirror the real table so nothing jumps on resolve. A low-amplitude pulse, no shimmer sweep — and the global reduced-motion rule stops it entirely, which is why the base colour has to read as a placeholder unaided."
      >
        <LoadingRegion label="Loading units">
          <Table caption="Units, loading">
            <THead>
              <HeaderRow>
                <Th scope="col">Unit</Th>
                <Th scope="col">Community</Th>
                <Th scope="col" numeric>Beds</Th>
                <Th scope="col" numeric>Rent</Th>
                <Th scope="col">Status</Th>
              </HeaderRow>
            </THead>
            <TBody>
              <TableSkeleton
                rows={4}
                columns={[
                  { width: "4rem" },
                  { width: "7rem" },
                  { width: "1.5rem", numeric: true },
                  { width: "5rem", numeric: true },
                  { width: "5rem" },
                ]}
              />
            </TBody>
          </Table>
        </LoadingRegion>

        <div className="mt-base flex flex-col gap-tight border-t border-rule pt-base">
          <Skeleton width="40%" className="h-8" />
          <Skeleton width="80%" />
          <Skeleton width="65%" />
        </div>
      </Section>

      <Section
        eyebrow="Density"
        title="Empty"
        note="Two different situations that usually get the same copy. Nothing-exists-yet names the thing to create; filtered-to-nothing quotes the search back and offers to widen it."
      >
        <div className="grid divide-rule border-y border-rule sm:grid-cols-2 sm:divide-x">
          <EmptyState
            icon="building"
            title="No units in Sable Yard"
            description="Add the first unit and it will appear here with its lease and ledger."
            action={<Button variant="secondary" size="small">Add a unit</Button>}
          />
          <NoResults
            query="Unit 41"
            onClear={<Button variant="ghost" size="small">Clear filters</Button>}
          />
        </div>
      </Section>
    </main>
  );
}

function StatTile({
  label,
  value,
  ratio,
  goodDirection,
}: {
  label: string;
  value: string;
  ratio: number;
  goodDirection: "up" | "down";
}) {
  return (
    <div>
      <dt className="eyebrow mb-tight">{label}</dt>
      {/* Proportional figures on purpose: §8 reserves tabular for columns. */}
      <dd className="flex items-baseline gap-tight">
        <span className="text-title text-ink">{value}</span>
        <Delta ratio={ratio} goodDirection={goodDirection} />
      </dd>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  note,
  children,
}: {
  eyebrow: string;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-loose">
      <p className="eyebrow mb-tight">{eyebrow}</p>
      <h2 className="mb-tight text-title text-ink">{title}</h2>
      <p className="mb-base max-w-prose text-ink-2">{note}</p>
      {children}
    </section>
  );
}
