import { cn } from "@/lib/cn";
import { Td, Tr } from "@/components/ui/table";

/**
 * Loading placeholder.
 *
 * §7 says motion confirms a state change and nothing else, which argues for
 * something static -- but a motionless grey block is indistinguishable from an
 * empty state, and "is this loading or is there nothing here" is a worse
 * failure than a little movement. So: a low-amplitude pulse, no shimmer sweep.
 * The sweeping gradient is the templated answer and it draws more attention
 * than the content it stands in for.
 *
 * The global prefers-reduced-motion rule in globals.css stops the animation
 * outright, which is why the base colour has to read as a placeholder on its
 * own rather than relying on movement to explain itself.
 */
export function Skeleton({
  className,
  width,
}: {
  className?: string;
  /** e.g. "60%". Varying widths stop a stack looking like a barcode. */
  width?: string;
}) {
  return (
    <span
      className={cn("block h-4 rounded-base bg-surface animate-pulse", className)}
      style={width ? { width } : undefined}
      aria-hidden
    />
  );
}

/**
 * Table loading state. Mirrors the real row height and column count so the
 * layout does not jump when data arrives -- a skeleton that shifts the page on
 * resolve is worse than no skeleton.
 *
 * The whole block is announced once as busy, rather than every cell chattering.
 */
export function TableSkeleton({
  rows = 8,
  columns,
}: {
  rows?: number;
  /** Per-column widths, so the placeholder has the real rhythm of the table. */
  columns: Array<{ width: string; numeric?: boolean }>;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <Tr key={row} className="hover:bg-transparent">
          {columns.map((column, index) => (
            <Td key={index} numeric={column.numeric}>
              <Skeleton
                width={column.width}
                className={column.numeric ? "ml-auto" : undefined}
              />
            </Td>
          ))}
        </Tr>
      ))}
    </>
  );
}

/** Wrap a loading region so it is announced once, not per placeholder. */
export function LoadingRegion({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div aria-busy="true" aria-live="polite" aria-label={label}>
      {children}
    </div>
  );
}
