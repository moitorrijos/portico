"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * The wrapper every chart in this app is required to wear.
 *
 * It supplies three things spec §8 asks for and that are easy to skip:
 *
 * 1. **`<figure>` / `<figcaption>` semantics**, so the chart is announced as a
 *    figure with a name rather than as a stray `<svg>`.
 * 2. **A table-view toggle on every chart.** Not a nicety. The sequential
 *    ramp's light end measures 2.36:1 on the ivory ground -- above §8's 2:1
 *    floor for a mark, but below 3:1, which obligates a non-colour route to
 *    every value. The table IS that route, which is why this is a required
 *    wrapper and not an optional one.
 * 3. **One place where the chart's title lives**, so a single series never
 *    grows a legend. A legend with one swatch restates the title and costs
 *    space; the title names what is plotted.
 *
 * Client component only because the toggle holds state. The chart itself is
 * passed in as `children` and rendered on the server -- a server component can
 * be a child of a client one, so the SVG never becomes part of the bundle.
 */
export function ChartFrame({
  title,
  caption,
  figure,
  table,
  children,
  className,
}: {
  title: string;
  /** The `<figcaption>`. Say what the reader should take from it, not what it is. */
  caption?: string;
  /** Optional headline value shown beside the title. */
  figure?: React.ReactNode;
  table: { headers: string[]; rows: (string | number)[][] };
  children: React.ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const panelId = useId();

  return (
    <figure className={cn("flex flex-col gap-tight", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-base gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-tight gap-y-1">
          <figcaption className="eyebrow">{title}</figcaption>
          {figure}
        </div>

        <button
          type="button"
          onClick={() => setView(view === "chart" ? "table" : "chart")}
          // aria-expanded would be wrong: this swaps one representation for
          // another rather than revealing extra content. The accessible name
          // says what pressing it does.
          aria-controls={panelId}
          className="eyebrow cursor-pointer underline decoration-rule underline-offset-4 transition-colors duration-200 ease-[var(--ease-standard)] hover:text-ink hover:decoration-ink-muted"
        >
          {view === "chart" ? "View as table" : "View as chart"}
        </button>
      </div>

      <div id={panelId}>
        {view === "chart" ? (
          children
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-body">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr className="border-y border-rule">
                  {table.headers.map((header, i) => (
                    <th
                      key={header}
                      scope="col"
                      className={cn(
                        "eyebrow px-tight py-tight first:pl-0 last:pr-0",
                        // First column is the category; the rest are values.
                        i > 0 && "text-right",
                      )}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {table.rows.map((row) => (
                  <tr key={String(row[0])}>
                    {row.map((cell, i) => (
                      <td
                        key={i}
                        className={cn(
                          "px-tight py-tight text-ink first:pl-0 last:pr-0",
                          // Tabular figures belong in columns -- this is
                          // exactly the case §8 reserves them for.
                          i > 0 && "figures-tabular text-right",
                        )}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {caption && <p className="text-caption text-ink-muted">{caption}</p>}
    </figure>
  );
}
