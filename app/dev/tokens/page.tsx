import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  formatDelta,
  formatMoney,
  formatMoneyAxis,
  formatPercent,
} from "@/lib/money";

export const metadata: Metadata = { title: "Tokens" };

/* Must be request-time. Prerendered, the APP_ENV check below would be
   evaluated during `next build` -- where APP_ENV is unset -- so the page would
   be baked as static and served in production anyway. Same trap as
   app/robots.ts. */
export const dynamic = "force-dynamic";

/* A working reference for the design system, not a page a visitor should ever
   reach. Kept in the repo because the alternative -- checking tokens by
   reading CSS -- is how a palette quietly drifts. */
const ROLES = [
  ["ground", "Page background. Never pure white."],
  ["surface", "One step from ground. Insets, table heads, wells."],
  ["ink", "Primary text."],
  ["ink-2", "Secondary text. Labels, captions, axis values."],
  ["ink-muted", "Tertiary. Holds the same value in both modes."],
  ["rule", "Hairlines. The only separator there is."],
  ["accent", "One accent. Everything else is ink, hairline or status."],
] as const;

const SEQUENTIAL = ["seq-1", "seq-2", "seq-3", "seq-4"] as const;

const STATUS = [
  ["good", "Paid, resolved, occupied"],
  ["warning", "Due soon, scheduled"],
  ["serious", "Late, needs attention"],
  ["critical", "Missed, urgent, vacant too long"],
] as const;

const LEDGER = [
  ["Unit 14B", "Marisol Arredondo", 187450, 0.041],
  ["Unit 3A", "Devon Whitfield", 1120000, -0.018],
  ["Unit 22C", "Priya Ramanathan", 96500, 0.0],
  ["Unit 9D", "Tomás Beltrán", 1004325, 0.127],
] as const;

export default function TokensPage() {
  // Never reachable in production. A design reference is internal by nature,
  // and shipping it would also be one more indexable page to reason about.
  if (process.env.APP_ENV === "production") notFound();

  return (
    <main className="mx-auto w-full max-w-4xl px-base py-loose">
      <header className="mb-loose flex items-baseline justify-between gap-base border-b border-rule pb-base">
        <div>
          <p className="eyebrow mb-tight">Design system</p>
          <h1 className="font-display text-display-sm text-ink">Tokens</h1>
        </div>
        <ThemeToggle />
      </header>

      <Section eyebrow="Colour" title="Roles">
        <p className="mb-base max-w-prose text-ink-2">
          Validated against the ivory ground, not against white. Two steps in
          the documented default ramp failed here and were corrected.
        </p>
        <dl className="divide-y divide-rule border-y border-rule">
          {ROLES.map(([role, use]) => (
            <div key={role} className="flex items-center gap-base py-tight">
              <span
                aria-hidden
                className="size-8 shrink-0 rounded-[var(--radius-base)] border border-rule"
                style={{ background: `var(--${role})` }}
              />
              <dt className="w-28 shrink-0 font-medium text-ink">{role}</dt>
              <dd className="text-ink-2">{use}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section eyebrow="Colour" title="Sequential ramp">
        <p className="mb-base max-w-prose text-ink-2">
          One hue, four steps, light end first. Used for occupancy bars and any
          single-series chart. A second series would take the orange slot, and
          categorical caps at three.
        </p>
        <div className="flex overflow-hidden rounded-[var(--radius-base)] border border-rule">
          {SEQUENTIAL.map((step) => (
            <div key={step} className="flex-1">
              <div className="h-12" style={{ background: `var(--${step})` }} />
              <p className="eyebrow border-t border-rule px-tight py-1">
                {step.replace("seq-", "")}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Colour" title="Status">
        <p className="mb-base max-w-prose text-ink-2">
          Reserved — never reused as a series colour. On the ivory, warning and
          serious sit below 3:1, so status always ships as icon and label and
          colour together. The pairing is load-bearing, not decoration.
        </p>
        <ul className="divide-y divide-rule border-y border-rule">
          {STATUS.map(([name, use]) => (
            <li key={name} className="flex items-center gap-base py-tight">
              <span
                className="inline-flex items-center gap-1.5 font-medium"
                style={{ color: `var(--status-${name})` }}
              >
                <Dot />
                {name}
              </span>
              <span className="text-ink-2">{use}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section eyebrow="Type" title="Plus Jakarta Sans — everything functional">
        <div className="space-y-base border-y border-rule py-base">
          <Specimen size="text-title" note="24px · in-app section heads">
            Occupancy by community
          </Specimen>
          <Specimen size="text-lead" note="18px · marketing body">
            Two audiences, one codebase.
          </Specimen>
          <Specimen size="text-body" note="14px · UI default, table cells">
            Rent collected this month, against the same month last year.
          </Specimen>
          <Specimen size="text-caption" note="12px · axis ticks, table meta">
            Updated 4 minutes ago
          </Specimen>
        </div>
      </Section>

      <Section eyebrow="Type" title="Playfair Display — editorial only">
        <p className="mb-base max-w-prose text-ink-2">
          Never near a number in a column: it has no tabular figures, so that is
          a structural limit rather than a preference. Floor of 28px, below
          which its hairlines go muddy on the ivory.
        </p>
        <div className="space-y-base border-y border-rule py-base">
          <Specimen
            size="text-display-lg"
            note="64px · marketing hero"
            display
          >
            Somewhere to arrive
          </Specimen>
          <Specimen size="text-display" note="44px · section heads" display>
            Three communities
          </Specimen>
          <Specimen size="text-display-sm" note="32px · page titles" display>
            Maintenance requests
          </Specimen>
        </div>
      </Section>

      <Section eyebrow="Type" title="The one gesture inside the app">
        <p className="mb-base max-w-prose text-ink-2">
          The hero occupancy figure is the only Playfair inside the manager app,
          and the only number allowed proportional figures. Everything under it
          is Plus Jakarta Sans.
        </p>
        <div className="border-y border-rule py-loose">
          <p className="eyebrow mb-tight">Occupancy</p>
          <p className="font-display text-figure leading-none text-ink">94.2%</p>
          <p className="mt-tight text-ink-2">
            <span className="figures-tabular">38</span> of{" "}
            <span className="figures-tabular">40</span> units occupied
          </p>
        </div>
      </Section>

      <Section eyebrow="Data" title="Figures that line up">
        <p className="mb-base max-w-prose text-ink-2">
          Tabular figures on table columns and axis ticks only. If the decimal
          points below do not form a straight edge, the face lacks the feature
          and the data screens need a different one.
        </p>
        <table className="w-full border-y border-rule text-body">
          <thead>
            <tr className="border-b border-rule">
              <th scope="col" className="eyebrow py-tight">Unit</th>
              <th scope="col" className="eyebrow py-tight">Resident</th>
              <th scope="col" className="eyebrow py-tight text-right">Balance</th>
              <th scope="col" className="eyebrow py-tight text-right">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {LEDGER.map(([unit, resident, cents, delta]) => (
              <tr key={unit}>
                <th scope="row" className="py-tight font-normal text-ink">
                  {unit}
                </th>
                <td className="py-tight text-ink-2">{resident}</td>
                <td className="figures-tabular py-tight text-right text-ink">
                  {formatMoney(cents)}
                </td>
                <td className="figures-tabular py-tight text-right text-ink-2">
                  {formatDelta(delta)}
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="py-tight font-normal text-ink-muted">
                Digit width
              </th>
              <td className="py-tight text-ink-muted">reference</td>
              <td className="figures-tabular py-tight text-right" id="tnum-on">
                1111111111
              </td>
              <td className="figures-tabular py-tight text-right">0000000000</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-base text-caption text-ink-muted">
          Axis tick format: {formatMoneyAxis(124850)} ·{" "}
          {formatMoneyAxis(1480320)} · {formatMoneyAxis(98000000)} — occupancy{" "}
          {formatPercent(0.9423)}
        </p>
      </Section>

      <Section eyebrow="Layout" title="Three spacing values, one radius">
        <p className="mb-base max-w-prose text-ink-2">
          Constraint is what makes it look expensive. Separation comes from
          space and a single hairline — no card shadows anywhere.
        </p>
        <div className="space-y-tight border-y border-rule py-base">
          {(
            [
              ["tight", "8px", "w-tight"],
              ["base", "16px", "w-base"],
              ["loose", "32px", "w-loose"],
            ] as const
          ).map(([name, px, w]) => (
            <div key={name} className="flex items-center gap-base">
              <span className={`${w} h-4 bg-accent`} aria-hidden />
              <span className="font-medium text-ink">{name}</span>
              <span className="figures-tabular text-ink-muted">{px}</span>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-loose">
      <p className="eyebrow mb-tight">{eyebrow}</p>
      <h2 className="mb-base text-title text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Specimen({
  size,
  note,
  display = false,
  children,
}: {
  size: string;
  note: string;
  display?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="eyebrow mb-1">{note}</p>
      <p className={`${size} ${display ? "font-display" : ""} text-ink`}>
        {children}
      </p>
    </div>
  );
}

/* Status never travels as colour alone, so even this reference sheet pairs it
   with a mark. */
function Dot() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden focusable="false">
      <circle cx="4" cy="4" r="4" fill="currentColor" />
    </svg>
  );
}
