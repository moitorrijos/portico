import { Skeleton } from "@/components/ui/skeleton";

/**
 * The units table while its query is in flight.
 *
 * Shaped like the table it replaces -- a header strip and rows of the same
 * height -- so the page does not jump when the real content lands. A centred
 * spinner would be less work and would move everything on arrival, which is
 * the thing a skeleton exists to prevent.
 *
 * Spec §11 counts designed loading and empty states among the details that
 * make an app read as finished rather than demoed, and this route is the one
 * with a real query behind it.
 */
export default function UnitsLoading() {
  return (
    <div className="flex flex-col gap-base py-tight">
      <div className="flex items-baseline justify-between gap-tight">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>

      <div className="flex flex-wrap items-end gap-tight border-b border-rule pb-base">
        {["12rem", "11rem", "10rem", "8rem"].map((width) => (
          <div key={width} className="flex flex-col gap-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9" width={width} />
          </div>
        ))}
      </div>

      <div className="flex flex-col">
        <div className="border-y border-rule py-tight">
          <Skeleton className="h-3 w-full" />
        </div>
        {/* Ten rows: enough to fill the fold at most window heights without
            implying a specific result count. */}
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="border-b border-rule py-tight">
            <Skeleton className="h-5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
