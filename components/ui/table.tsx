import Link from "next/link";
import type {
  TdHTMLAttributes,
  ThHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/**
 * Table primitives. The units table is the density showcase, so the semantics
 * are the point: real `<th>` with a real `scope`, a caption that screen
 * readers get even when it is visually hidden, and figures that line up.
 *
 * `scope` is a required prop on Th rather than an optional one. A header cell
 * without it is ambiguous to a screen reader, and "remember to add scope" is
 * the kind of rule that survives review twice and then quietly stops.
 */

export function Table({
  caption,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableElement> & {
  /** Required. Announced to screen readers; visually hidden by default. */
  caption: string;
  children: ReactNode;
}) {
  return (
    /* The wrapper scrolls, not the page. A wide table must never make the
       whole document scroll sideways. */
    <div className="w-full overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-body", className)}
        {...props}
      >
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function THead({
  sticky = false,
  children,
}: {
  /** For long tables. Needs an opaque background or rows show through. */
  sticky?: boolean;
  children: ReactNode;
}) {
  return (
    <thead
      className={cn(
        sticky && "sticky top-0 z-10 bg-ground",
      )}
    >
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-rule">{children}</tbody>;
}

export function HeaderRow({ children }: { children: ReactNode }) {
  return <tr className="border-y border-rule">{children}</tr>;
}

export function Tr({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    /* `relative` so a RowLink can stretch across the whole row. */
    <tr
      className={cn(
        "relative transition-colors duration-200 ease-standard hover:bg-surface",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function Th({
  scope,
  numeric,
  children,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & {
  /** Required -- see the note at the top of this file. */
  scope: "col" | "row" | "colgroup" | "rowgroup";
  numeric?: boolean;
}) {
  const isColumnHeader = scope === "col";

  return (
    <th
      scope={scope}
      className={cn(
        "py-tight first:pl-0 last:pr-0 px-tight",
        // Column heads get the small tracked label treatment; row heads are
        // content and stay in body type.
        isColumnHeader ? "eyebrow" : "font-normal text-ink",
        numeric && "figures-tabular text-right",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({
  numeric,
  children,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & {
  /** Tabular figures and right alignment. §8 reserves these for columns. */
  numeric?: boolean;
}) {
  return (
    <td
      className={cn(
        "py-tight px-tight text-ink first:pl-0 last:pr-0",
        numeric && "figures-tabular text-right",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

/**
 * Makes a whole row clickable without breaking the keyboard.
 *
 * The stretched-link pattern: a real anchor in the first cell, with an
 * `::after` covering the row. One tab stop, a real href, works with
 * middle-click and "open in new tab" -- all of which an `onClick` on the `<tr>`
 * silently takes away.
 */
export function RowLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "font-medium text-ink after:absolute after:inset-0 after:content-['']",
        "hover:underline hover:decoration-rule hover:underline-offset-4",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/**
 * A sortable column header. Renders a button inside the `<th>` and sets
 * `aria-sort` on the header itself, which is where assistive tech looks --
 * putting it on the button is a common and silent mistake.
 *
 * Props are listed explicitly rather than extending ThHTMLAttributes: the
 * interactive element here is the button, so inheriting table-cell event
 * handlers would type the wrong element and let a caller attach a handler that
 * never fires where they expect.
 */
export function SortableTh({
  numeric,
  direction,
  onSort,
  href,
  children,
  className,
}: {
  numeric?: boolean;
  /** `undefined` means this column is not the active sort. */
  direction?: "asc" | "desc";
  onSort?: () => void;
  /**
   * Renders the control as a link to the same page with different sort
   * parameters, instead of a button.
   *
   * Preferred wherever the sort lives in the URL. A button needs client state,
   * which means the sort is lost on reload, cannot be linked to a colleague,
   * and does not exist at all until JavaScript runs. A link is a real
   * navigation the server answers — and it keeps the table a server component.
   */
  href?: string;
  children: ReactNode;
  className?: string;
}) {
  const nextLabel =
    direction === "asc" ? "descending" : "ascending";

  const label = `Sort by ${String(children)}, ${nextLabel}`;
  const controlClassName = cn(
    "eyebrow inline-flex cursor-pointer items-center gap-1",
    "transition-colors duration-200 ease-standard hover:text-ink",
    direction && "text-ink",
    numeric && "w-full justify-end",
  );

  if (href) {
    return (
      <th
        scope="col"
        aria-sort={
          direction === "asc"
            ? "ascending"
            : direction === "desc"
              ? "descending"
              : "none"
        }
        className={cn("eyebrow px-tight py-tight first:pl-0 last:pr-0", className)}
      >
        <Link href={href} aria-label={label} className={controlClassName}>
          {children}
          {direction && (
            <Icon name={direction === "asc" ? "arrowUp" : "arrowDown"} size={12} />
          )}
        </Link>
      </th>
    );
  }

  return (
    <th
      scope="col"
      aria-sort={
        direction === "asc"
          ? "ascending"
          : direction === "desc"
            ? "descending"
            : "none"
      }
      className={cn("eyebrow px-tight py-tight first:pl-0 last:pr-0", className)}
    >
      <button
        type="button"
        onClick={onSort}
        // The visible label is the column name; the sort action needs to say
        // what pressing it will do, not restate the heading.
        aria-label={label}
        className={controlClassName}
      >
        {children}
        {/* Only the active column shows an arrow. An arrow on every header is
            noise that tells you nothing about the current state. */}
        {direction && (
          <Icon name={direction === "asc" ? "arrowUp" : "arrowDown"} size={12} />
        )}
      </button>
    </th>
  );
}
